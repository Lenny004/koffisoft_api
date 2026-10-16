import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { RequestMetadata } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ContactMessageStatus,
  CustomerType,
  EventStatus,
  ReservationStatus,
  UserStatus,
} from '../generated/prisma/enums.js';
import { EventsService } from '../events/events.service.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import {
  ContactMessageListQueryDto,
  ConvertContactToEventDto,
  ConvertContactToReservationDto,
  CreatePublicContactMessageDto,
  UpdateContactMessageDto,
} from './dto/contact.dto.js';
import {
  ContactAuditResponseDto,
  ContactConversionResponseDto,
  ContactMessagePageDto,
  ContactMessageResponseDto,
  ContactRelationResponseDto,
  PublicContactMessageResponseDto,
} from './dto/contact-response.dto.js';
import { ContactRateLimitService } from './contact-rate-limit.service.js';

const DUPLICATE_WINDOW_MS = 15 * 60_000;
const contactInclude = {
  assignedTo: { select: { id: true, username: true } },
  customer: { select: { id: true, displayName: true } },
  reservation: { select: { id: true, reservationCode: true } },
  event: { select: { id: true, eventCode: true, title: true } },
} as const;

type ContactRecord = Prisma.ContactMessageGetPayload<{ include: typeof contactInclude }>;

/** Coordina recepción pública, bandeja administrativa y conversiones idempotentes. */
@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: ContactRateLimitService,
    private readonly reservations: ReservationsService,
    private readonly events: EventsService,
  ) {}

  async createPublic(
    dto: CreatePublicContactMessageDto,
    ipAddress = 'unknown',
  ): Promise<PublicContactMessageResponseDto> {
    if (dto.website?.trim()) return { accepted: true };

    this.rateLimit.assertAllowed(`${ipAddress}:${dto.locationId}`);
    await this.ensureLocation(dto.locationId);

    const email = dto.email.trim().toLowerCase();
    const duplicate = await this.prisma.contactMessage.findFirst({
      where: {
        locationId: dto.locationId,
        email,
        message: dto.message,
        receivedAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (duplicate) return { accepted: true };

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.contactMessage.create({
        data: {
          locationId: dto.locationId,
          nameSnapshot: dto.name,
          email,
          phone: dto.phone,
          languageCode: dto.languageCode,
          topic: dto.topic,
          message: dto.message,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: 'contact_message.received',
          entityType: 'contact_message',
          entityId: message.id,
          afterData: { locationId: dto.locationId, topic: dto.topic },
          ipAddress: ipAddress === 'unknown' ? undefined : ipAddress,
        },
      });
    });

    return { accepted: true };
  }

  async list(query: ContactMessageListQueryDto): Promise<ContactMessagePageDto> {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        include: contactInclude,
        orderBy: { receivedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row, [])),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(id: string, locationId: string): Promise<ContactMessageResponseDto> {
    const row = await this.findContact(id, locationId);
    const audits = await this.prisma.auditLog.findMany({
      where: { entityType: 'contact_message', entityId: row.id },
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.toResponse(
      row,
      audits.map((audit) => this.toAudit(audit)),
    );
  }

  async update(
    id: string,
    locationId: string,
    dto: UpdateContactMessageDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<ContactMessageResponseDto> {
    const current = await this.findContact(id, locationId);
    this.assertTransition(current.status, dto.status);

    if (dto.assignedToUserId) await this.assertAssignee(dto.assignedToUserId, locationId);

    const archivedAt = dto.archived === undefined ? undefined : dto.archived ? new Date() : null;
    const archivedByUserId =
      dto.archived === undefined ? undefined : dto.archived ? actorUserId : null;
    const status = dto.status ?? current.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.contactMessage.update({
        where: { id: current.id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.assignedToUserId !== undefined ? { assignedToUserId: dto.assignedToUserId } : {}),
          ...(dto.status === ContactMessageStatus.Replied ? { repliedAt: new Date() } : {}),
          ...(archivedAt !== undefined ? { archivedAt, archivedByUserId } : {}),
        },
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: dto.archived === true ? 'contact_message.archived' : 'contact_message.updated',
        entityId: current.id,
        beforeData: this.auditState(current),
        afterData: {
          status,
          assignedToUserId: dto.assignedToUserId ?? current.assignedToUserId,
          archivedAt,
        },
      });
    });

    return this.get(id, locationId);
  }

  async convertToCustomer(
    id: string,
    locationId: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<ContactConversionResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.contactMessage.findFirst({
        where: { id, locationId },
        include: contactInclude,
      });
      if (!current) throw new NotFoundException('Mensaje de contacto no encontrado.');
      if (current.customerId) return { id: current.customerId, created: false };

      const customer = await tx.customer.create({
        data: {
          customerType: CustomerType.Person,
          displayName: current.nameSnapshot,
          phone: current.phone,
          email: current.email,
          preferredLanguage: current.languageCode,
        },
      });
      await tx.contactMessage.update({
        where: { id: current.id },
        data: { customerId: customer.id, status: ContactMessageStatus.InProgress },
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'contact_message.converted_customer',
        entityId: current.id,
        beforeData: this.auditState(current),
        afterData: { customerId: customer.id, status: ContactMessageStatus.InProgress },
      });
      return { id: customer.id, created: true };
    });

    return { type: 'customer', ...result };
  }

  async convertToReservation(
    id: string,
    locationId: string,
    dto: ConvertContactToReservationDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<ContactConversionResponseDto> {
    const current = await this.findContact(id, locationId);
    if (current.reservationId)
      return { type: 'reservation', id: current.reservationId, created: false };

    const customerId = current.customerId ?? (await this.createCustomerFromContact(current));
    const reservation = await this.reservations.createAdminReservation(
      {
        locationId,
        date: dto.date,
        time: dto.time,
        durationMinutes: dto.durationMinutes,
        partySize: dto.partySize,
        customerId,
        contactName: current.nameSnapshot,
        contactPhone: dto.contactPhone,
        contactEmail: current.email,
        preferredLanguage: current.languageCode,
        preferredSpaceId: dto.preferredSpaceId,
        internalNotes: current.message,
        status: ReservationStatus.PendingConfirmation,
        tableIds: [],
      },
      actorUserId,
    );
    await this.linkConversion(
      current,
      locationId,
      { reservationId: reservation.id, customerId, status: ContactMessageStatus.InProgress },
      actorUserId,
      metadata,
      'contact_message.converted_reservation',
    );
    return { type: 'reservation', id: reservation.id, created: true };
  }

  async convertToEvent(
    id: string,
    locationId: string,
    dto: ConvertContactToEventDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<ContactConversionResponseDto> {
    const current = await this.findContact(id, locationId);
    if (current.eventId) return { type: 'event', id: current.eventId, created: false };

    const customerId = current.customerId ?? (await this.createCustomerFromContact(current));
    const event = await this.events.createEvent({
      locationId,
      customerId,
      eventType: dto.eventType,
      title: dto.title,
      contactName: current.nameSnapshot,
      contactPhone: current.phone ?? 'Sin teléfono',
      contactEmail: current.email,
      preferredLanguage: current.languageCode,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      estimatedGuestCount: dto.estimatedGuestCount,
      budgetTarget: dto.budgetTarget,
      status: EventStatus.Inquiry,
      source: 'contact',
      specialRequirements: current.message,
    });
    await this.linkConversion(
      current,
      locationId,
      { eventId: event.id, customerId, status: ContactMessageStatus.InProgress },
      actorUserId,
      metadata,
      'contact_message.converted_event',
    );
    return { type: 'event', id: event.id, created: true };
  }

  private buildWhere(query: ContactMessageListQueryDto): Prisma.ContactMessageWhereInput {
    return {
      locationId: query.locationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.search
        ? {
            OR: [
              { nameSnapshot: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { message: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async findContact(id: string, locationId: string): Promise<ContactRecord> {
    const row = await this.prisma.contactMessage.findFirst({
      where: { id, locationId },
      include: contactInclude,
    });
    if (!row) throw new NotFoundException('Mensaje de contacto no encontrado.');
    return row;
  }

  private async ensureLocation(locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private async assertAssignee(userId: string, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { businessId: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.Active,
        roles: { some: { active: true, role: { active: true, businessId: location.businessId } } },
      },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Usuario asignable no encontrado.');
  }

  private assertTransition(current: ContactMessageStatus, target?: ContactMessageStatus): void {
    if (!target || target === current) return;
    const allowed: Record<ContactMessageStatus, readonly ContactMessageStatus[]> = {
      [ContactMessageStatus.New]: [
        ContactMessageStatus.InProgress,
        ContactMessageStatus.Replied,
        ContactMessageStatus.Closed,
        ContactMessageStatus.Spam,
      ],
      [ContactMessageStatus.InProgress]: [
        ContactMessageStatus.Replied,
        ContactMessageStatus.Closed,
        ContactMessageStatus.Spam,
      ],
      [ContactMessageStatus.Replied]: [ContactMessageStatus.Closed],
      [ContactMessageStatus.Closed]: [],
      [ContactMessageStatus.Spam]: [],
    };
    if (!allowed[current].includes(target)) {
      throw new BadRequestException(`El mensaje no puede pasar de ${current} a ${target}.`);
    }
  }

  private async createCustomerFromContact(current: ContactRecord): Promise<string> {
    const customer = await this.prisma.customer.create({
      data: {
        customerType: CustomerType.Person,
        displayName: current.nameSnapshot,
        phone: current.phone,
        email: current.email,
        preferredLanguage: current.languageCode,
      },
      select: { id: true },
    });
    return customer.id;
  }

  private async linkConversion(
    current: ContactRecord,
    locationId: string,
    data: {
      customerId: string;
      status: ContactMessageStatus;
      reservationId?: string;
      eventId?: string;
    },
    actorUserId: string,
    metadata: RequestMetadata,
    action: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const latest = await tx.contactMessage.findFirst({ where: { id: current.id, locationId } });
      if (!latest) throw new NotFoundException('Mensaje de contacto no encontrado.');
      if (data.reservationId && latest.reservationId) return;
      if (data.eventId && latest.eventId) return;
      await tx.contactMessage.update({ where: { id: current.id }, data });
      await this.writeAudit(tx, actorUserId, metadata, {
        action,
        entityId: current.id,
        beforeData: this.auditState(current),
        afterData: data,
      });
    });
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    metadata: RequestMetadata,
    event: { action: string; entityId: string; beforeData: object; afterData: object },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: event.action,
        entityType: 'contact_message',
        entityId: event.entityId,
        beforeData: event.beforeData,
        afterData: event.afterData,
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
      },
    });
  }

  private auditState(row: ContactRecord): object {
    return {
      status: row.status,
      assignedToUserId: row.assignedToUserId,
      customerId: row.customerId,
      reservationId: row.reservationId,
      eventId: row.eventId,
      archivedAt: row.archivedAt,
    };
  }

  private toResponse(
    row: ContactRecord,
    audit: ContactAuditResponseDto[],
  ): ContactMessageResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      customerId: row.customerId,
      reservationId: row.reservationId,
      eventId: row.eventId,
      name: row.nameSnapshot,
      email: row.email,
      phone: row.phone,
      languageCode: row.languageCode,
      topic: row.topic,
      message: row.message,
      status: row.status,
      assignedToUserId: row.assignedToUserId,
      assignedToUsername: row.assignedTo?.username ?? null,
      customer: row.customer ? this.relation(row.customer.id, row.customer.displayName) : null,
      reservation: row.reservation
        ? this.relation(row.reservation.id, row.reservation.reservationCode)
        : null,
      event: row.event
        ? this.relation(row.event.id, `${row.event.eventCode} · ${row.event.title}`)
        : null,
      receivedAt: row.receivedAt.toISOString(),
      repliedAt: row.repliedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      archivedByUserId: row.archivedByUserId,
      audit,
    };
  }

  private relation(id: string, label: string): ContactRelationResponseDto {
    return { id, label };
  }

  private toAudit(row: {
    action: string;
    actorUserId: string | null;
    actor: { username: string } | null;
    createdAt: Date;
  }): ContactAuditResponseDto {
    return {
      action: row.action,
      actorUserId: row.actorUserId,
      actorUsername: row.actor?.username ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
