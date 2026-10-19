import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { PublicationStatus } from '../generated/prisma/enums.js';
import type {
  AnnouncementListQueryDto,
  CreateAnnouncementDto,
  PublicAnnouncementQueryDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';
import type { AnnouncementResponseDto } from './dto/announcement-response.dto.js';

/** Coordina la vigencia editorial y el CRUD de avisos por sede. */
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista avisos publicados y vigentes para consumo público por sede.
   */
  async listPublic(query: PublicAnnouncementQueryDto): Promise<AnnouncementResponseDto[]> {
    const now = new Date();
    const rows = await this.prisma.importantAnnouncement.findMany({
      where: {
        locationId: query.locationId,
        active: true,
        publicationStatus: PublicationStatus.Published,
        publishedAt: { lte: now },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  /**
   * Lista avisos de una sede para administración con filtro de inactivos.
   */
  async listAdmin(query: AnnouncementListQueryDto): Promise<AnnouncementResponseDto[]> {
    const rows = await this.prisma.importantAnnouncement.findMany({
      where: { locationId: query.locationId, ...(query.includeInactive ? {} : { active: true }) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  /**
   * Crea un aviso validando sede, fechas y URL del CTA.
   */
  async create(dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    this.validateDates(dto.startsAt, dto.endsAt);
    const ctaUrl = validateCtaUrl(dto.ctaUrl);
    await this.requireLocation(dto.locationId);
    const row = await this.prisma.importantAnnouncement.create({
      data: {
        locationId: dto.locationId,
        title: dto.title,
        message: dto.message,
        ctaLabel: dto.ctaLabel || null,
        ctaUrl,
        startsAt: this.toDate(dto.startsAt),
        endsAt: this.toDate(dto.endsAt),
        displayOrder: dto.displayOrder,
        active: dto.active,
      },
    });
    return this.toResponse(row);
  }

  async update(
    id: string,
    locationId: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const current = await this.prisma.importantAnnouncement.findFirst({
      where: { id, locationId },
    });
    if (!current) throw new NotFoundException('Aviso importante no encontrado.');
    const startsAt = dto.startsAt === undefined ? current.startsAt : this.toDate(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? current.endsAt : this.toDate(dto.endsAt);
    this.validateDates(startsAt?.toISOString(), endsAt?.toISOString());
    const ctaUrl = dto.ctaUrl === undefined ? undefined : validateCtaUrl(dto.ctaUrl);
    const result = await this.prisma.importantAnnouncement.updateMany({
      where: { id, locationId },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.message === undefined ? {} : { message: dto.message }),
        ...(dto.ctaLabel === undefined ? {} : { ctaLabel: dto.ctaLabel || null }),
        ...(ctaUrl === undefined ? {} : { ctaUrl }),
        ...(dto.startsAt === undefined ? {} : { startsAt }),
        ...(dto.endsAt === undefined ? {} : { endsAt }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
        ...(dto.active === undefined ? {} : { active: dto.active }),
      },
    });
    if (result.count !== 1) throw new NotFoundException('Aviso importante no encontrado.');
    const row = await this.prisma.importantAnnouncement.findFirstOrThrow({
      where: { id, locationId },
    });
    return this.toResponse(row);
  }

  /**
   * Desactiva un aviso de la sede indicada (borrado lógico).
   */
  async remove(id: string, locationId: string): Promise<AnnouncementResponseDto> {
    const result = await this.prisma.importantAnnouncement.updateMany({
      where: { id, locationId },
      data: { active: false },
    });
    if (result.count !== 1) throw new NotFoundException('Aviso importante no encontrado.');
    const row = await this.prisma.importantAnnouncement.findFirstOrThrow({
      where: { id, locationId },
    });
    return this.toResponse(row);
  }

  private async requireLocation(id: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private validateDates(startsAt?: string | null, endsAt?: string | null): void {
    if (!startsAt || !endsAt) return;
    const starts = new Date(startsAt);
    const ends = new Date(endsAt);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      throw new BadRequestException('La fecha final debe ser posterior a la fecha inicial.');
    }
  }

  private toDate(value?: string | null): Date | null {
    if (value === undefined || value === null || value === '') return null;
    return new Date(value);
  }

  private toResponse(row: {
    id: string;
    locationId: string;
    title: string;
    message: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    publicationStatus: PublicationStatus;
    publishedAt: Date | null;
    scheduledAt: Date | null;
    expiresAt: Date | null;
    displayOrder: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AnnouncementResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      title: row.title,
      message: row.message,
      ctaLabel: row.ctaLabel,
      ctaUrl: row.ctaUrl,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      publicationStatus: row.publicationStatus,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      displayOrder: row.displayOrder,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/** Solo permite rutas internas o URL absolutas HTTP(S) para enlaces editoriales. */
export function validateCtaUrl(value?: string | null): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const candidate = value.trim();
  if (/[\u0000-\u001f\u007f\\]/u.test(candidate)) {
    throw new BadRequestException(
      'El enlace del botón debe ser una URL HTTP(S) o una ruta relativa.',
    );
  }
  if (candidate.startsWith('/')) {
    if (candidate.startsWith('//')) {
      throw new BadRequestException(
        'El enlace del botón debe ser una URL HTTP(S) o una ruta relativa.',
      );
    }
    return candidate;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new BadRequestException(
      'El enlace del botón debe ser una URL HTTP(S) o una ruta relativa.',
    );
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !/^https?:\/\//iu.test(candidate)) {
    throw new BadRequestException(
      'El enlace del botón debe ser una URL HTTP(S) o una ruta relativa.',
    );
  }
  return candidate;
}
