import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import { PublicationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import type { PublicationResourceType, UpdatePublicationDto } from './dto/publication.dto.js';
import type {
  PreviewResponseDto,
  PreviewTokenResponseDto,
  PublicationContextResponseDto,
  PublicationResponseDto,
} from './dto/publication-response.dto.js';

const PREVIEW_TTL_MS = 15 * 60 * 1000;
const EL_SALVADOR_TIMEZONE = 'America/El_Salvador';

const announcementSelect = {
  id: true,
  locationId: true,
  publicationStatus: true,
  publishedAt: true,
  scheduledAt: true,
  expiresAt: true,
  previewTokenHash: true,
  previewExpiresAt: true,
  location: { select: { timezone: true } },
  title: true,
  message: true,
  ctaLabel: true,
  ctaUrl: true,
  startsAt: true,
  endsAt: true,
  displayOrder: true,
  active: true,
} as const;

const menuItemSelect = {
  id: true,
  publicationStatus: true,
  publishedAt: true,
  scheduledAt: true,
  expiresAt: true,
  previewTokenHash: true,
  previewExpiresAt: true,
  category: { select: { locationId: true, location: { select: { timezone: true } } } },
  slug: true,
  itemType: true,
  nameEs: true,
  nameEn: true,
  descriptionEs: true,
  descriptionEn: true,
  publicVisible: true,
  active: true,
} as const;

const eventSelect = {
  id: true,
  locationId: true,
  publicationStatus: true,
  publishedAt: true,
  scheduledAt: true,
  expiresAt: true,
  previewTokenHash: true,
  previewExpiresAt: true,
  location: { select: { timezone: true } },
  eventCode: true,
  eventType: true,
  title: true,
  startsAt: true,
  endsAt: true,
  estimatedGuestCount: true,
  status: true,
} as const;

type PublicationRecord = {
  id: string;
  locationId: string;
  timezone: string;
  publicationStatus: PublicationStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  previewTokenHash: string | null;
  previewExpiresAt: Date | null;
};

type PublicationIdentity = PublicationRecord & { resourceType: PublicationResourceType };

/** Aplica estados editoriales comunes sin duplicar entidades de contenido. */
@Injectable()
export class PublicationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la zona horaria editorial de una sede activa para programar publicaciones.
   */
  async getContext(locationId: string): Promise<PublicationContextResponseDto> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true, timezone: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
    return { locationId: location.id, timezone: location.timezone || EL_SALVADOR_TIMEZONE };
  }

  async updatePublication(
    resourceType: PublicationResourceType,
    resourceId: string,
    locationId: string,
    dto: UpdatePublicationDto,
    actorUserId: string,
  ): Promise<PublicationResponseDto> {
    const current = await this.getIdentity(resourceType, resourceId);
    this.assertLocation(current, locationId);
    const now = new Date();
    const next = this.resolveNextState(dto, now);
    const before = this.snapshot(current);

    await this.prisma.$transaction(async (tx) => {
      await this.updateState(tx, resourceType, resourceId, next);
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `content.${dto.action}`,
          entityType: resourceType,
          entityId: resourceId,
          beforeData: before,
          afterData: this.snapshot({ ...current, ...next }),
        },
      });
    });

    return this.toResponse(resourceType, {
      ...current,
      ...next,
    });
  }

  async createPreview(
    resourceType: PublicationResourceType,
    resourceId: string,
    locationId: string,
    actorUserId: string,
  ): Promise<PreviewTokenResponseDto> {
    const current = await this.getIdentity(resourceType, resourceId);
    this.assertLocation(current, locationId);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);

    await this.updatePreviewToken(resourceType, resourceId, tokenHash, expiresAt, actorUserId);

    return {
      resourceType,
      resourceId,
      previewPath: `/preview/${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Valida un token de vista previa, lo consume una sola vez y devuelve el recurso en borrador.
   */
  async consumePreview(token: string): Promise<PreviewResponseDto> {
    if (!/^[A-Za-z0-9_-]{32,128}$/u.test(token)) {
      throw new NotFoundException('Vista previa no encontrada o expirada.');
    }
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const candidates = await Promise.all([
      this.prisma.importantAnnouncement.findFirst({
        where: { previewTokenHash: tokenHash, previewExpiresAt: { gt: now } },
        select: announcementSelect,
      }),
      this.prisma.menuItem.findFirst({
        where: { previewTokenHash: tokenHash, previewExpiresAt: { gt: now } },
        select: menuItemSelect,
      }),
      this.prisma.event.findFirst({
        where: { previewTokenHash: tokenHash, previewExpiresAt: { gt: now } },
        select: eventSelect,
      }),
    ]);
    const found = candidates.find((row) => row !== null);
    if (!found) throw new NotFoundException('Vista previa no encontrada o expirada.');

    const resourceType = this.resourceTypeForPreview(found);
    const resourceId = found.id;
    const consumed = await this.consumeToken(resourceType, resourceId, tokenHash, now);
    if (!consumed) throw new NotFoundException('Vista previa no encontrada o expirada.');

    return this.toPreviewResponse(resourceType, found);
  }

  /** Activa programaciones vencidas y retira publicaciones expiradas de forma idempotente. */
  async processDueTransitions(now = new Date()): Promise<number> {
    let transitions = 0;
    transitions += await this.processScheduled('announcement', now);
    transitions += await this.processScheduled('menu_item', now);
    transitions += await this.processScheduled('event', now);
    transitions += await this.processExpired('announcement', now);
    transitions += await this.processExpired('menu_item', now);
    transitions += await this.processExpired('event', now);
    return transitions;
  }

  private async getIdentity(
    resourceType: PublicationResourceType,
    resourceId: string,
  ): Promise<PublicationIdentity> {
    if (resourceType === 'announcement') {
      const row = await this.prisma.importantAnnouncement.findUnique({
        select: announcementSelect,
        where: { id: resourceId },
      });
      if (!row) throw new NotFoundException('Aviso importante no encontrado.');
      return this.announcementIdentity(row);
    }
    if (resourceType === 'menu_item') {
      const row = await this.prisma.menuItem.findUnique({
        select: menuItemSelect,
        where: { id: resourceId },
      });
      if (!row) throw new NotFoundException('Ítem de menú no encontrado.');
      return this.menuItemIdentity(row);
    }
    if (resourceType === 'event') {
      const row = await this.prisma.event.findUnique({
        select: eventSelect,
        where: { id: resourceId },
      });
      if (!row) throw new NotFoundException('Evento no encontrado.');
      return this.eventIdentity(row);
    }
    throw new BadRequestException('Tipo de contenido no válido.');
  }

  private resolveNextState(
    dto: UpdatePublicationDto,
    now: Date,
  ): {
    publicationStatus: PublicationStatus;
    publishedAt: Date | null;
    scheduledAt: Date | null;
    expiresAt: Date | null;
  } {
    const publishedAt = this.toDate(dto.publishedAt);
    const scheduledAt = this.toDate(dto.scheduledAt);
    const expiresAt = this.toDate(dto.expiresAt);
    if (dto.action === 'draft' || dto.action === 'unpublish') {
      return {
        publicationStatus: PublicationStatus.Draft,
        publishedAt: null,
        scheduledAt: null,
        expiresAt: null,
      };
    }
    if (dto.action === 'schedule') {
      if (!scheduledAt || scheduledAt <= now) {
        throw new BadRequestException('La fecha programada debe estar en el futuro.');
      }
      this.validateExpiry(expiresAt, scheduledAt);
      return {
        publicationStatus: PublicationStatus.Scheduled,
        publishedAt: null,
        scheduledAt,
        expiresAt,
      };
    }
    const effectivePublishedAt = publishedAt ?? now;
    this.validateExpiry(expiresAt, effectivePublishedAt);
    return {
      publicationStatus: PublicationStatus.Published,
      publishedAt: effectivePublishedAt,
      scheduledAt: null,
      expiresAt,
    };
  }

  private validateExpiry(expiresAt: Date | null, startsAt: Date): void {
    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException('La fecha de expiración debe ser posterior a la publicación.');
    }
  }

  private async updateState(
    tx: Prisma.TransactionClient,
    resourceType: PublicationResourceType,
    resourceId: string,
    next: {
      publicationStatus: PublicationStatus;
      publishedAt: Date | null;
      scheduledAt: Date | null;
      expiresAt: Date | null;
    },
  ): Promise<void> {
    if (resourceType === 'announcement') {
      await tx.importantAnnouncement.update({ where: { id: resourceId }, data: next });
      return;
    }
    if (resourceType === 'menu_item') {
      await tx.menuItem.update({ where: { id: resourceId }, data: next });
      return;
    }
    await tx.event.update({ where: { id: resourceId }, data: next });
  }

  private async updatePreviewToken(
    resourceType: PublicationResourceType,
    resourceId: string,
    tokenHash: string,
    expiresAt: Date,
    actorUserId: string,
  ): Promise<void> {
    const tokenData = { previewTokenHash: tokenHash, previewExpiresAt: expiresAt };
    await this.prisma.$transaction(async (tx) => {
      if (resourceType === 'announcement') {
        await tx.importantAnnouncement.update({ where: { id: resourceId }, data: tokenData });
      } else if (resourceType === 'menu_item') {
        await tx.menuItem.update({ where: { id: resourceId }, data: tokenData });
      } else {
        await tx.event.update({ where: { id: resourceId }, data: tokenData });
      }
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'content.preview.create',
          entityType: resourceType,
          entityId: resourceId,
          afterData: { expiresAt: expiresAt.toISOString() },
        },
      });
    });
  }

  private async consumeToken(
    resourceType: PublicationResourceType,
    resourceId: string,
    tokenHash: string,
    now: Date,
  ): Promise<boolean> {
    const where = { id: resourceId, previewTokenHash: tokenHash, previewExpiresAt: { gt: now } };
    const data = { previewTokenHash: null, previewExpiresAt: null };
    const result =
      resourceType === 'announcement'
        ? await this.prisma.importantAnnouncement.updateMany({ where, data })
        : resourceType === 'menu_item'
          ? await this.prisma.menuItem.updateMany({ where, data })
          : await this.prisma.event.updateMany({ where, data });
    return result.count === 1;
  }

  private async processScheduled(
    resourceType: PublicationResourceType,
    now: Date,
  ): Promise<number> {
    const rows = await this.findDue(resourceType, PublicationStatus.Scheduled, now);
    let count = 0;
    for (const row of rows) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await this.updateDue(tx, resourceType, row.id, PublicationStatus.Scheduled, {
          publicationStatus: PublicationStatus.Published,
          publishedAt: now,
          scheduledAt: null,
        });
        if (!result) return false;
        await tx.auditLog.create({
          data: {
            action: 'content.auto_publish',
            entityType: resourceType,
            entityId: row.id,
            beforeData: this.snapshot(row),
            afterData: this.snapshot({
              ...row,
              publicationStatus: PublicationStatus.Published,
              publishedAt: now,
              scheduledAt: null,
            }),
          },
        });
        return true;
      });
      if (updated) count += 1;
    }
    return count;
  }

  private async processExpired(resourceType: PublicationResourceType, now: Date): Promise<number> {
    const rows = await this.findExpired(resourceType, now);
    let count = 0;
    for (const row of rows) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await this.updateDue(tx, resourceType, row.id, PublicationStatus.Published, {
          publicationStatus: PublicationStatus.Draft,
          publishedAt: null,
          scheduledAt: null,
          expiresAt: null,
        });
        if (!result) return false;
        await tx.auditLog.create({
          data: {
            action: 'content.auto_expire',
            entityType: resourceType,
            entityId: row.id,
            beforeData: this.snapshot(row),
            afterData: this.snapshot({
              ...row,
              publicationStatus: PublicationStatus.Draft,
              publishedAt: null,
              scheduledAt: null,
              expiresAt: null,
            }),
          },
        });
        return true;
      });
      if (updated) count += 1;
    }
    return count;
  }

  private async findDue(
    resourceType: PublicationResourceType,
    status: PublicationStatus,
    now: Date,
  ): Promise<PublicationIdentity[]> {
    const where = { publicationStatus: status, scheduledAt: { lte: now } };
    if (resourceType === 'announcement') {
      const rows = await this.prisma.importantAnnouncement.findMany({
        where,
        select: announcementSelect,
      });
      return rows.map((row) => this.announcementIdentity(row));
    }
    if (resourceType === 'menu_item') {
      const rows = await this.prisma.menuItem.findMany({ where, select: menuItemSelect });
      return rows.map((row) => this.menuItemIdentity(row));
    }
    const rows = await this.prisma.event.findMany({ where, select: eventSelect });
    return rows.map((row) => this.eventIdentity(row));
  }

  private async findExpired(
    resourceType: PublicationResourceType,
    now: Date,
  ): Promise<PublicationIdentity[]> {
    const where = { publicationStatus: PublicationStatus.Published, expiresAt: { lte: now } };
    if (resourceType === 'announcement') {
      const rows = await this.prisma.importantAnnouncement.findMany({
        where,
        select: announcementSelect,
      });
      return rows.map((row) => this.announcementIdentity(row));
    }
    if (resourceType === 'menu_item') {
      const rows = await this.prisma.menuItem.findMany({ where, select: menuItemSelect });
      return rows.map((row) => this.menuItemIdentity(row));
    }
    const rows = await this.prisma.event.findMany({ where, select: eventSelect });
    return rows.map((row) => this.eventIdentity(row));
  }

  private async updateDue(
    tx: Prisma.TransactionClient,
    resourceType: PublicationResourceType,
    resourceId: string,
    currentStatus: PublicationStatus,
    data: {
      publicationStatus: PublicationStatus;
      publishedAt: Date | null;
      scheduledAt: Date | null;
      expiresAt?: Date | null;
    },
  ): Promise<boolean> {
    const where = { id: resourceId, publicationStatus: currentStatus };
    const result =
      resourceType === 'announcement'
        ? await tx.importantAnnouncement.updateMany({ where, data })
        : resourceType === 'menu_item'
          ? await tx.menuItem.updateMany({ where, data })
          : await tx.event.updateMany({ where, data });
    return result.count === 1;
  }

  private assertLocation(resource: PublicationIdentity, locationId: string): void {
    if (resource.locationId !== locationId) {
      throw new NotFoundException('Contenido editorial no encontrado en la sede indicada.');
    }
  }

  private toResponse(
    resourceType: PublicationResourceType,
    row: PublicationRecord,
  ): PublicationResponseDto {
    return {
      resourceType,
      resourceId: row.id,
      locationId: row.locationId,
      timezone: row.timezone || EL_SALVADOR_TIMEZONE,
      publicationStatus: row.publicationStatus,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  private toPreviewResponse(
    resourceType: PublicationResourceType,
    row: Record<string, unknown>,
  ): PreviewResponseDto {
    const identity = this.identityFromPreview(resourceType, row);
    return {
      resourceType,
      resourceId: identity.id,
      locationId: identity.locationId,
      noindex: true,
      resource: this.publicResource(resourceType, row),
    };
  }

  private publicResource(
    resourceType: PublicationResourceType,
    row: Record<string, any>,
  ): Record<string, unknown> {
    if (resourceType === 'announcement') {
      return {
        title: row.title,
        message: row.message,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        startsAt: row.startsAt?.toISOString() ?? null,
        endsAt: row.endsAt?.toISOString() ?? null,
      };
    }
    if (resourceType === 'menu_item') {
      return {
        slug: row.slug,
        itemType: String(row.itemType).toLowerCase(),
        nameEs: row.nameEs,
        nameEn: row.nameEn,
        descriptionEs: row.descriptionEs,
        descriptionEn: row.descriptionEn,
      };
    }
    return {
      eventCode: row.eventCode,
      eventType: row.eventType,
      title: row.title,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      estimatedGuestCount: row.estimatedGuestCount,
    };
  }

  private resourceTypeForPreview(row: unknown): PublicationResourceType {
    if (row && typeof row === 'object' && 'category' in row) return 'menu_item';
    if (row && typeof row === 'object' && 'eventCode' in row) return 'event';
    return 'announcement';
  }

  private identityFromPreview(
    resourceType: PublicationResourceType,
    row: Record<string, any>,
  ): PublicationIdentity {
    if (resourceType === 'menu_item') return this.menuItemIdentity(row);
    if (resourceType === 'event') return this.eventIdentity(row);
    return this.announcementIdentity(row);
  }

  private announcementIdentity(row: any): PublicationIdentity {
    return this.identity('announcement', row.id, row.locationId, row.location?.timezone, row);
  }

  private menuItemIdentity(row: any): PublicationIdentity {
    return this.identity(
      'menu_item',
      row.id,
      row.category.locationId,
      row.category.location?.timezone,
      row,
    );
  }

  private eventIdentity(row: any): PublicationIdentity {
    return this.identity('event', row.id, row.locationId, row.location?.timezone, row);
  }

  private identity(
    resourceType: PublicationResourceType,
    id: string,
    locationId: string,
    timezone: string | undefined,
    row: any,
  ): PublicationIdentity {
    return {
      resourceType,
      id,
      locationId,
      timezone: timezone || EL_SALVADOR_TIMEZONE,
      publicationStatus: row.publicationStatus,
      publishedAt: row.publishedAt,
      scheduledAt: row.scheduledAt,
      expiresAt: row.expiresAt,
      previewTokenHash: row.previewTokenHash,
      previewExpiresAt: row.previewExpiresAt,
    };
  }

  private snapshot(row: Partial<PublicationRecord>): Prisma.InputJsonObject {
    return {
      publicationStatus: row.publicationStatus,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  private toDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('La fecha editorial no es válida.');
    return date;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
