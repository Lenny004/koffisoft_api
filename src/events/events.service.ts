import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  EventQuoteLineType,
  EventSpaceBookingStatus,
  EventStatus,
  QuoteStatus,
} from '../generated/prisma/enums.js';
import {
  CreateEventDto,
  CreateEventPackageDto,
  CreateEventRequirementDto,
  CreateEventSpaceBookingDto,
  CreateEventQuoteDto,
  CreatePublicEventRequestDto,
  EventListQueryDto,
  UpdateEventDto,
  UpdateEventPackageDto,
  UpdateEventQuoteStatusDto,
  UpdateEventRequirementDto,
} from './dto/event.dto.js';
import {
  EventPageDto,
  EventPackageLineResponseDto,
  EventPackageResponseDto,
  EventQuoteLineResponseDto,
  EventQuotePageDto,
  EventQuoteResponseDto,
  EventRequirementResponseDto,
  EventResponseDto,
  EventSpaceBookingResponseDto,
  PublicEventCatalogResponseDto,
  PublicEventRequestResponseDto,
  PublicEventSpaceDto,
} from './dto/event-response.dto.js';

const eventInclude = {
  spaceBookings: { orderBy: { startsAt: 'asc' as const } },
  requirements: { orderBy: { createdAt: 'asc' as const } },
} as const;

const packageInclude = {
  lines: { orderBy: { sortOrder: 'asc' as const } },
} as const;

const quoteInclude = {
  lines: { orderBy: { sortOrder: 'asc' as const } },
} as const;

type EventRecord = Prisma.EventGetPayload<{ include: typeof eventInclude }>;
type PackageRecord = Prisma.EventPackageGetPayload<{ include: typeof packageInclude }>;
type QuoteRecord = Prisma.EventQuoteGetPayload<{ include: typeof quoteInclude }>;

/** Coordina eventos privados, espacios, paquetes, cotizaciones y requisitos. */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicCatalog(locationId: string): Promise<PublicEventCatalogResponseDto> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');

    const [spaces, packages] = await Promise.all([
      this.prisma.venueSpace.findMany({
        where: { locationId, active: true, allowsPrivateEvent: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.eventPackage.findMany({
        where: { locationId, active: true },
        orderBy: { nameEs: 'asc' },
      }),
    ]);

    return {
      locationId,
      spaces: spaces.map((space): PublicEventSpaceDto => ({
        id: space.id,
        code: space.code,
        nameEs: space.nameEs,
        nameEn: space.nameEn,
        spaceType: space.spaceType,
        seatedCapacity: space.seatedCapacity,
        standingCapacity: space.standingCapacity,
      })),
      packages: packages.map((pkg) => ({
        id: pkg.id,
        packageCode: pkg.packageCode,
        nameEs: pkg.nameEs,
        nameEn: pkg.nameEn,
        descriptionEs: pkg.descriptionEs,
        descriptionEn: pkg.descriptionEn,
        pricingModel: pkg.pricingModel,
        minGuestCount: pkg.minGuestCount,
        maxGuestCount: pkg.maxGuestCount,
      })),
    };
  }

  async createPublicEventRequest(
    dto: CreatePublicEventRequestDto,
  ): Promise<PublicEventRequestResponseDto> {
    validateInterval(dto.startsAt, dto.endsAt, dto.setupStartsAt);
    validateNonNegativeDecimal(dto.budgetTarget, 'El presupuesto');
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');

    const event = await this.prisma.event.create({
      data: {
        locationId: dto.locationId,
        eventCode: this.newEventCode(),
        eventType: dto.eventType,
        title: dto.title,
        contactNameSnapshot: dto.contactName,
        contactPhoneSnapshot: dto.contactPhone,
        contactEmailSnapshot: dto.contactEmail,
        preferredLanguage: dto.preferredLanguage,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        setupStartsAt: dto.setupStartsAt ? new Date(dto.setupStartsAt) : undefined,
        estimatedGuestCount: dto.estimatedGuestCount,
        budgetTarget: dto.budgetTarget ? new Prisma.Decimal(dto.budgetTarget) : undefined,
        status: EventStatus.Inquiry,
        source: 'web',
        specialRequirements: dto.specialRequirements,
      },
    });

    return this.toPublicEvent(event);
  }

  async listEvents(query: EventListQueryDto): Promise<EventPageDto> {
    const where: Prisma.EventWhereInput = {
      locationId: query.locationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: { startsAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toEvent(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  async getEvent(id: string): Promise<EventResponseDto> {
    const row = await this.prisma.event.findUnique({ where: { id }, include: eventInclude });
    if (!row) throw new NotFoundException('Evento no encontrado.');
    return this.toEvent(row);
  }

  async createEvent(dto: CreateEventDto): Promise<EventResponseDto> {
    validateInterval(dto.startsAt, dto.endsAt, dto.setupStartsAt);
    validateGuestRange(dto.estimatedGuestCount, dto.confirmedGuestCount);
    validateNonNegativeDecimal(dto.budgetTarget, 'El presupuesto');
    await this.ensureLocation(dto.locationId);
    try {
      const row = await this.prisma.event.create({
        data: {
          locationId: dto.locationId,
          customerId: dto.customerId,
          eventCode: dto.eventCode ?? this.newEventCode(),
          eventType: dto.eventType,
          title: dto.title,
          contactNameSnapshot: dto.contactName,
          contactPhoneSnapshot: dto.contactPhone,
          contactEmailSnapshot: dto.contactEmail,
          preferredLanguage: dto.preferredLanguage,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          setupStartsAt: dto.setupStartsAt ? new Date(dto.setupStartsAt) : undefined,
          estimatedGuestCount: dto.estimatedGuestCount,
          confirmedGuestCount: dto.confirmedGuestCount,
          budgetTarget: dto.budgetTarget ? new Prisma.Decimal(dto.budgetTarget) : undefined,
          status: dto.status,
          source: dto.source,
          specialRequirements: dto.specialRequirements,
          internalNotes: dto.internalNotes,
          coordinatorUserId: dto.coordinatorUserId,
        },
        include: eventInclude,
      });
      return this.toEvent(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async updateEvent(id: string, dto: UpdateEventDto): Promise<EventResponseDto> {
    const current = await this.prisma.event.findUnique({
      where: { id },
      select: { startsAt: true, endsAt: true, setupStartsAt: true },
    });
    if (!current) throw new NotFoundException('Evento no encontrado.');
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    const currentEvent = await this.prisma.event.findUnique({
      where: { id },
      select: { estimatedGuestCount: true, confirmedGuestCount: true },
    });
    if (!currentEvent) throw new NotFoundException('Evento no encontrado.');
    validateGuestRange(
      dto.estimatedGuestCount ?? currentEvent.estimatedGuestCount,
      dto.confirmedGuestCount ?? currentEvent.confirmedGuestCount ?? undefined,
    );
    validateNonNegativeDecimal(dto.budgetTarget, 'El presupuesto');
    validateInterval(
      startsAt.toISOString(),
      endsAt.toISOString(),
      dto.setupStartsAt ?? current.setupStartsAt?.toISOString(),
    );

    try {
      const row = await this.prisma.event.update({
        where: { id },
        data: {
          ...(dto.eventType === undefined ? {} : { eventType: dto.eventType }),
          ...(dto.title === undefined ? {} : { title: dto.title }),
          ...(dto.contactName === undefined ? {} : { contactNameSnapshot: dto.contactName }),
          ...(dto.contactPhone === undefined ? {} : { contactPhoneSnapshot: dto.contactPhone }),
          ...(dto.contactEmail === undefined ? {} : { contactEmailSnapshot: dto.contactEmail }),
          ...(dto.startsAt === undefined ? {} : { startsAt }),
          ...(dto.endsAt === undefined ? {} : { endsAt }),
          ...(dto.setupStartsAt === undefined
            ? {}
            : { setupStartsAt: new Date(dto.setupStartsAt) }),
          ...(dto.estimatedGuestCount === undefined
            ? {}
            : { estimatedGuestCount: dto.estimatedGuestCount }),
          ...(dto.confirmedGuestCount === undefined
            ? {}
            : { confirmedGuestCount: dto.confirmedGuestCount }),
          ...(dto.budgetTarget === undefined
            ? {}
            : { budgetTarget: new Prisma.Decimal(dto.budgetTarget) }),
          ...(dto.status === undefined ? {} : { status: dto.status }),
          ...(dto.specialRequirements === undefined
            ? {}
            : { specialRequirements: dto.specialRequirements }),
          ...(dto.internalNotes === undefined ? {} : { internalNotes: dto.internalNotes }),
          ...(dto.coordinatorUserId === undefined
            ? {}
            : { coordinatorUserId: dto.coordinatorUserId }),
        },
        include: eventInclude,
      });
      return this.toEvent(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  /** El schema no tiene `active` para eventos; eliminar equivale a cancelarlos. */
  async deleteEvent(id: string): Promise<EventResponseDto> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.event.update({
          where: { id },
          data: { status: EventStatus.Cancelled },
        });
        await tx.eventSpaceBooking.updateMany({
          where: {
            eventId: id,
            bookingStatus: {
              in: [EventSpaceBookingStatus.Held, EventSpaceBookingStatus.Confirmed],
            },
          },
          data: { bookingStatus: EventSpaceBookingStatus.Released },
        });
      });
      return this.getEvent(id);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async createSpaceBooking(
    eventId: string,
    dto: CreateEventSpaceBookingDto,
  ): Promise<EventSpaceBookingResponseDto> {
    validateBookingInterval(dto);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, locationId: true },
    });
    if (!event) throw new NotFoundException('Evento no encontrado.');
    const space = await this.prisma.venueSpace.findFirst({
      where: {
        id: dto.venueSpaceId,
        locationId: event.locationId,
        active: true,
        allowsPrivateEvent: true,
      },
      select: { id: true, seatedCapacity: true, standingCapacity: true },
    });
    if (!space)
      throw new BadRequestException('El espacio no pertenece a la sede o no admite eventos.');
    const maximumCapacity = space.standingCapacity ?? space.seatedCapacity;
    if (dto.capacityReserved > maximumCapacity) {
      throw new BadRequestException('La capacidad reservada supera la capacidad del espacio.');
    }

    const existing = await this.prisma.eventSpaceBooking.findMany({
      where: {
        venueSpaceId: dto.venueSpaceId,
        bookingStatus: { in: [EventSpaceBookingStatus.Held, EventSpaceBookingStatus.Confirmed] },
      },
      select: {
        id: true,
        eventId: true,
        startsAt: true,
        endsAt: true,
        setupStartsAt: true,
        teardownEndsAt: true,
        holdExpiresAt: true,
        bookingStatus: true,
      },
    });
    const requestedStart = dto.setupStartsAt ? new Date(dto.setupStartsAt) : new Date(dto.startsAt);
    const requestedEnd = dto.teardownEndsAt ? new Date(dto.teardownEndsAt) : new Date(dto.endsAt);
    const overlaps = existing.some((booking) => {
      if (booking.eventId === eventId) return false;
      if (
        booking.bookingStatus === EventSpaceBookingStatus.Held &&
        booking.holdExpiresAt &&
        booking.holdExpiresAt <= new Date()
      ) {
        return false;
      }
      const start = booking.setupStartsAt ?? booking.startsAt;
      const end = booking.teardownEndsAt ?? booking.endsAt;
      return start < requestedEnd && end > requestedStart;
    });
    if (overlaps) throw new ConflictException('El espacio ya está reservado en ese horario.');

    try {
      const row = await this.prisma.eventSpaceBooking.create({
        data: {
          eventId,
          venueSpaceId: dto.venueSpaceId,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          setupStartsAt: dto.setupStartsAt ? new Date(dto.setupStartsAt) : undefined,
          teardownEndsAt: dto.teardownEndsAt ? new Date(dto.teardownEndsAt) : undefined,
          bookingStatus: dto.bookingStatus,
          capacityReserved: dto.capacityReserved,
          holdExpiresAt: dto.holdExpiresAt ? new Date(dto.holdExpiresAt) : undefined,
        },
      });
      return this.toSpaceBooking(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async releaseSpaceBooking(id: string): Promise<EventSpaceBookingResponseDto> {
    try {
      const row = await this.prisma.eventSpaceBooking.update({
        where: { id },
        data: { bookingStatus: EventSpaceBookingStatus.Released },
      });
      return this.toSpaceBooking(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async listPackages(
    locationId: string,
    includeInactive = false,
  ): Promise<EventPackageResponseDto[]> {
    const rows = await this.prisma.eventPackage.findMany({
      where: { locationId, ...(includeInactive ? {} : { active: true }) },
      include: packageInclude,
      orderBy: { nameEs: 'asc' },
    });
    return rows.map((row) => this.toPackage(row));
  }

  async getPackage(id: string): Promise<EventPackageResponseDto> {
    const row = await this.prisma.eventPackage.findUnique({
      where: { id },
      include: packageInclude,
    });
    if (!row) throw new NotFoundException('Paquete de eventos no encontrado.');
    return this.toPackage(row);
  }

  async createPackage(dto: CreateEventPackageDto): Promise<EventPackageResponseDto> {
    await this.ensureLocation(dto.locationId);
    dto.lines?.forEach(validatePackageLine);
    validatePackageGuestRange(dto.minGuestCount, dto.maxGuestCount);
    validateNonNegativeDecimal(dto.basePrice, 'El precio base');
    const row = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.eventPackage.create({
        data: {
          locationId: dto.locationId,
          packageCode: dto.packageCode,
          nameEs: dto.nameEs,
          nameEn: dto.nameEn,
          descriptionEs: dto.descriptionEs,
          descriptionEn: dto.descriptionEn,
          pricingModel: dto.pricingModel,
          basePrice: nonNegativeDecimal(dto.basePrice, 'El precio base'),
          minGuestCount: dto.minGuestCount,
          maxGuestCount: dto.maxGuestCount,
          active: dto.active,
        },
      });
      if (dto.lines?.length) {
        await tx.eventPackageLine.createMany({
          data: dto.lines.map((line) => ({
            eventPackageId: pkg.id,
            lineType: line.lineType,
            menuItemVariantId: line.menuItemVariantId,
            labelEs: line.labelEs,
            labelEn: line.labelEn,
            quantity: positiveDecimal(line.quantity, 'La cantidad de la línea'),
            unit: line.unit,
            unitPrice: nonNegativeDecimal(line.unitPrice, 'El precio unitario'),
            sortOrder: line.sortOrder,
            active: line.active,
          })),
        });
      }
      return tx.eventPackage.findUniqueOrThrow({ where: { id: pkg.id }, include: packageInclude });
    });
    return this.toPackage(row);
  }

  async updatePackage(id: string, dto: UpdateEventPackageDto): Promise<EventPackageResponseDto> {
    dto.lines?.forEach(validatePackageLine);
    const current = await this.prisma.eventPackage.findUnique({
      where: { id },
      select: { minGuestCount: true, maxGuestCount: true },
    });
    if (!current) throw new NotFoundException('Paquete de eventos no encontrado.');
    validatePackageGuestRange(
      dto.minGuestCount ?? current.minGuestCount ?? undefined,
      dto.maxGuestCount ?? current.maxGuestCount ?? undefined,
    );
    validateNonNegativeDecimal(dto.basePrice, 'El precio base');
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.eventPackage.update({
          where: { id },
          data: {
            ...(dto.packageCode === undefined ? {} : { packageCode: dto.packageCode }),
            ...(dto.nameEs === undefined ? {} : { nameEs: dto.nameEs }),
            ...(dto.nameEn === undefined ? {} : { nameEn: dto.nameEn }),
            ...(dto.descriptionEs === undefined ? {} : { descriptionEs: dto.descriptionEs }),
            ...(dto.descriptionEn === undefined ? {} : { descriptionEn: dto.descriptionEn }),
            ...(dto.pricingModel === undefined ? {} : { pricingModel: dto.pricingModel }),
            ...(dto.basePrice === undefined
              ? {}
              : { basePrice: nonNegativeDecimal(dto.basePrice, 'El precio base') }),
            ...(dto.minGuestCount === undefined ? {} : { minGuestCount: dto.minGuestCount }),
            ...(dto.maxGuestCount === undefined ? {} : { maxGuestCount: dto.maxGuestCount }),
            ...(dto.active === undefined ? {} : { active: dto.active }),
          },
        });
        if (dto.lines !== undefined) {
          await tx.eventPackageLine.deleteMany({ where: { eventPackageId: id } });
          if (dto.lines.length) {
            await tx.eventPackageLine.createMany({
              data: dto.lines.map((line) => ({
                eventPackageId: id,
                lineType: line.lineType,
                menuItemVariantId: line.menuItemVariantId,
                labelEs: line.labelEs,
                labelEn: line.labelEn,
                quantity: positiveDecimal(line.quantity, 'La cantidad de la línea'),
                unit: line.unit,
                unitPrice: nonNegativeDecimal(line.unitPrice, 'El precio unitario'),
                sortOrder: line.sortOrder,
                active: line.active,
              })),
            });
          }
        }
        return tx.eventPackage.findUniqueOrThrow({ where: { id }, include: packageInclude });
      });
      return this.toPackage(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async deletePackage(id: string): Promise<EventPackageResponseDto> {
    return this.updatePackage(id, { active: false });
  }

  async listQuotes(eventId: string): Promise<EventQuotePageDto> {
    const rows = await this.prisma.eventQuote.findMany({
      where: { eventId },
      include: quoteInclude,
      orderBy: { versionNo: 'desc' },
    });
    return {
      data: rows.map((row) => this.toQuote(row)),
      meta: { page: 1, pageSize: rows.length, total: rows.length, totalPages: rows.length ? 1 : 0 },
    };
  }

  async getQuote(id: string): Promise<EventQuoteResponseDto> {
    const row = await this.prisma.eventQuote.findUnique({ where: { id }, include: quoteInclude });
    if (!row) throw new NotFoundException('Cotización no encontrada.');
    return this.toQuote(row);
  }

  async createQuote(eventId: string, dto: CreateEventQuoteDto): Promise<EventQuoteResponseDto> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, locationId: true },
    });
    if (!event) throw new NotFoundException('Evento no encontrado.');
    if (dto.eventPackageId) {
      const pkg = await this.prisma.eventPackage.findFirst({
        where: { id: dto.eventPackageId, locationId: event.locationId },
        select: { id: true },
      });
      if (!pkg) throw new BadRequestException('El paquete no pertenece a la sede del evento.');
    }
    const totals = calculateQuoteTotals(dto);
    const quote = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.eventQuote.findFirst({
        where: { eventId },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      });
      const created = await tx.eventQuote.create({
        data: {
          eventId,
          eventPackageId: dto.eventPackageId,
          versionNo: (latest?.versionNo ?? 0) + 1,
          status: QuoteStatus.Draft,
          validUntil: new Date(dto.validUntil),
          subtotalAmount: totals.subtotalAmount,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          termsEs: dto.termsEs,
          termsEn: dto.termsEn,
        },
      });
      await tx.eventQuoteLine.createMany({
        data: totals.lines.map((line) => ({ eventQuoteId: created.id, ...line })),
      });
      return tx.eventQuote.findUniqueOrThrow({ where: { id: created.id }, include: quoteInclude });
    });
    return this.toQuote(quote);
  }

  async updateQuoteStatus(
    id: string,
    dto: UpdateEventQuoteStatusDto,
  ): Promise<EventQuoteResponseDto> {
    const now = new Date();
    try {
      const row = await this.prisma.eventQuote.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === QuoteStatus.Sent ? { sentAt: now } : {}),
          ...(dto.status === QuoteStatus.Accepted ? { acceptedAt: now } : {}),
        },
        include: quoteInclude,
      });
      return this.toQuote(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async createRequirement(
    eventId: string,
    dto: CreateEventRequirementDto,
  ): Promise<EventRequirementResponseDto> {
    await this.ensureEvent(eventId);
    const row = await this.prisma.eventRequirement.create({ data: { eventId, ...dto } });
    return this.toRequirement(row);
  }

  async updateRequirement(
    id: string,
    dto: UpdateEventRequirementDto,
  ): Promise<EventRequirementResponseDto> {
    try {
      const row = await this.prisma.eventRequirement.update({
        where: { id },
        data: {
          ...(dto.description === undefined ? {} : { description: dto.description }),
          ...(dto.guestCount === undefined ? {} : { guestCount: dto.guestCount }),
          ...(dto.severity === undefined ? {} : { severity: dto.severity }),
          ...(dto.status === undefined ? {} : { status: dto.status }),
          ...(dto.resolvedAt === undefined ? {} : { resolvedAt: new Date(dto.resolvedAt) }),
        },
      });
      return this.toRequirement(row);
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  async deleteRequirement(id: string): Promise<void> {
    try {
      await this.prisma.eventRequirement.delete({ where: { id } });
    } catch (error) {
      this.rethrowPrisma(error);
      throw error;
    }
  }

  private async ensureLocation(locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private async ensureEvent(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Evento no encontrado.');
  }

  private toPublicEvent(row: {
    eventCode: string;
    status: EventStatus;
    startsAt: Date;
    endsAt: Date;
  }): PublicEventRequestResponseDto {
    return {
      eventCode: row.eventCode,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    };
  }

  private toEvent(row: EventRecord): EventResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      eventCode: row.eventCode,
      eventType: row.eventType,
      title: row.title,
      contactNameSnapshot: row.contactNameSnapshot,
      contactPhoneSnapshot: row.contactPhoneSnapshot,
      contactEmailSnapshot: row.contactEmailSnapshot,
      preferredLanguage: row.preferredLanguage,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      setupStartsAt: row.setupStartsAt?.toISOString() ?? null,
      estimatedGuestCount: row.estimatedGuestCount,
      confirmedGuestCount: row.confirmedGuestCount,
      budgetTarget: row.budgetTarget?.toString() ?? null,
      status: row.status,
      source: row.source,
      specialRequirements: row.specialRequirements,
      internalNotes: row.internalNotes,
      coordinatorUserId: row.coordinatorUserId,
      spaceBookings: row.spaceBookings.map((booking) => this.toSpaceBooking(booking)),
      requirements: row.requirements.map((requirement) => this.toRequirement(requirement)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSpaceBooking(row: {
    id: string;
    eventId: string;
    venueSpaceId: string;
    startsAt: Date;
    endsAt: Date;
    setupStartsAt: Date | null;
    teardownEndsAt: Date | null;
    bookingStatus: EventSpaceBookingStatus;
    capacityReserved: number;
    holdExpiresAt: Date | null;
  }): EventSpaceBookingResponseDto {
    return {
      id: row.id,
      eventId: row.eventId,
      venueSpaceId: row.venueSpaceId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      setupStartsAt: row.setupStartsAt?.toISOString() ?? null,
      teardownEndsAt: row.teardownEndsAt?.toISOString() ?? null,
      bookingStatus: row.bookingStatus,
      capacityReserved: row.capacityReserved,
      holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
    };
  }

  private toRequirement(row: {
    id: string;
    eventId: string;
    requirementType: string;
    description: string;
    guestCount: number | null;
    severity: string;
    status: string;
    resolvedAt: Date | null;
    createdAt: Date;
  }): EventRequirementResponseDto {
    return {
      id: row.id,
      eventId: row.eventId,
      requirementType: row.requirementType,
      description: row.description,
      guestCount: row.guestCount,
      severity: row.severity,
      status: row.status,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toPackage(row: PackageRecord): EventPackageResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      packageCode: row.packageCode,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      descriptionEs: row.descriptionEs,
      descriptionEn: row.descriptionEn,
      pricingModel: row.pricingModel,
      basePrice: row.basePrice.toString(),
      minGuestCount: row.minGuestCount,
      maxGuestCount: row.maxGuestCount,
      active: row.active,
      lines: row.lines.map((line): EventPackageLineResponseDto => ({
        id: line.id,
        lineType: line.lineType,
        menuItemVariantId: line.menuItemVariantId,
        labelEs: line.labelEs,
        labelEn: line.labelEn,
        quantity: line.quantity.toString(),
        unit: line.unit,
        unitPrice: line.unitPrice.toString(),
        sortOrder: line.sortOrder,
        active: line.active,
      })),
    };
  }

  private toQuote(row: QuoteRecord): EventQuoteResponseDto {
    return {
      id: row.id,
      eventId: row.eventId,
      eventPackageId: row.eventPackageId,
      versionNo: row.versionNo,
      status: row.status,
      currency: row.currency,
      validUntil: row.validUntil.toISOString().slice(0, 10),
      subtotalAmount: row.subtotalAmount.toString(),
      discountAmount: row.discountAmount.toString(),
      taxableAmount: row.taxableAmount.toString(),
      taxAmount: row.taxAmount.toString(),
      totalAmount: row.totalAmount.toString(),
      termsEs: row.termsEs,
      termsEn: row.termsEn,
      lines: row.lines.map((line): EventQuoteLineResponseDto => ({
        id: line.id,
        eventPackageLineId: line.eventPackageLineId,
        menuItemVariantId: line.menuItemVariantId,
        lineType: line.lineType,
        labelEs: line.labelEs,
        labelEn: line.labelEn,
        quantity: line.quantity.toString(),
        unit: line.unit,
        unitPrice: line.unitPrice.toString(),
        discountAmount: line.discountAmount.toString(),
        taxRate: line.taxRate.toString(),
        taxableAmount: line.taxableAmount.toString(),
        taxAmount: line.taxAmount.toString(),
        lineTotal: line.lineTotal.toString(),
        sortOrder: line.sortOrder,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private newEventCode(): string {
    return `EVT-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private rethrowPrisma(error: unknown): void {
    if (this.isPrismaCode(error, 'P2002'))
      throw new ConflictException('El recurso ya existe o está ocupado.');
    if (this.isPrismaCode(error, 'P2025')) throw new NotFoundException('El recurso no existe.');
  }

  private isPrismaCode(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}

export interface QuoteCalculation {
  readonly lines: Array<{
    eventPackageLineId?: string;
    menuItemVariantId?: string;
    lineType: EventQuoteLineType;
    labelEs: string;
    labelEn: string;
    quantity: Prisma.Decimal;
    unit: string;
    unitPrice: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxableAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    sortOrder: number;
  }>;
  readonly subtotalAmount: Prisma.Decimal;
  readonly discountAmount: Prisma.Decimal;
  readonly taxableAmount: Prisma.Decimal;
  readonly taxAmount: Prisma.Decimal;
  readonly totalAmount: Prisma.Decimal;
}

/** Calcula con Decimal.js los importes persistidos de una cotización y sus líneas. */
export function calculateQuoteTotals(dto: CreateEventQuoteDto): QuoteCalculation {
  const lines = dto.lines.map((line) => {
    if (
      (line.lineType === EventQuoteLineType.Menu ||
        line.lineType === EventQuoteLineType.Beverage) &&
      !line.menuItemVariantId
    ) {
      throw new BadRequestException('Las líneas de menú o bebida requieren una variante.');
    }
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const discountAmount = new Prisma.Decimal(line.discountAmount);
    const taxRate = new Prisma.Decimal(line.taxRate);
    if (
      quantity.lte(0) ||
      unitPrice.lt(0) ||
      discountAmount.lt(0) ||
      taxRate.lt(0) ||
      taxRate.gt(1)
    ) {
      throw new BadRequestException('Los valores de una línea de cotización no son válidos.');
    }
    const gross = quantity.mul(unitPrice).toDecimalPlaces(2);
    if (discountAmount.gt(gross)) {
      throw new BadRequestException('El descuento de una línea no puede superar su importe.');
    }
    const taxableAmount = gross.sub(discountAmount).toDecimalPlaces(2);
    const taxAmount = taxableAmount.mul(taxRate).toDecimalPlaces(2);
    const lineTotal = taxableAmount.add(taxAmount).toDecimalPlaces(2);
    return {
      eventPackageLineId: line.eventPackageLineId,
      menuItemVariantId: line.menuItemVariantId,
      lineType: line.lineType,
      labelEs: line.labelEs,
      labelEn: line.labelEn,
      quantity,
      unit: line.unit,
      unitPrice,
      discountAmount,
      taxRate,
      taxableAmount,
      taxAmount,
      lineTotal,
      sortOrder: line.sortOrder,
    };
  });
  const subtotalAmount = lines
    .reduce(
      (sum, line) => sum.add(line.taxableAmount).add(line.discountAmount),
      new Prisma.Decimal(0),
    )
    .toDecimalPlaces(2);
  const discountAmount = lines
    .reduce((sum, line) => sum.add(line.discountAmount), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  const taxableAmount = lines
    .reduce((sum, line) => sum.add(line.taxableAmount), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  const taxAmount = lines
    .reduce((sum, line) => sum.add(line.taxAmount), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  const totalAmount = lines
    .reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  return { lines, subtotalAmount, discountAmount, taxableAmount, taxAmount, totalAmount };
}

function validateInterval(startsAt: string, endsAt: string, setupStartsAt?: string): void {
  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    throw new BadRequestException('El intervalo del evento no es válido.');
  }
  if (setupStartsAt && new Date(setupStartsAt) >= starts) {
    throw new BadRequestException('El montaje debe iniciar antes del evento.');
  }
}

function validateBookingInterval(dto: CreateEventSpaceBookingDto): void {
  validateInterval(dto.startsAt, dto.endsAt, dto.setupStartsAt);
  if (dto.teardownEndsAt && new Date(dto.teardownEndsAt) <= new Date(dto.endsAt)) {
    throw new BadRequestException('El desmontaje debe terminar después del evento.');
  }
  if (dto.holdExpiresAt && new Date(dto.holdExpiresAt) <= new Date()) {
    throw new BadRequestException('La retención del espacio ya expiró.');
  }
}

function nonNegativeDecimal(value: string, label: string): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);
  if (decimal.isNegative()) throw new BadRequestException(`${label} no puede ser negativo.`);
  return decimal;
}

function positiveDecimal(value: string, label: string): Prisma.Decimal {
  const decimal = nonNegativeDecimal(value, label);
  if (decimal.isZero()) throw new BadRequestException(`${label} debe ser mayor que cero.`);
  return decimal;
}

function validateNonNegativeDecimal(value: string | undefined, label: string): void {
  if (value !== undefined) nonNegativeDecimal(value, label);
}

function validateGuestRange(
  estimatedGuestCount: number,
  confirmedGuestCount?: number,
  minGuestCount?: number,
  maxGuestCount?: number,
): void {
  if (confirmedGuestCount !== undefined && confirmedGuestCount > estimatedGuestCount) {
    throw new BadRequestException('La cantidad confirmada no puede superar la estimada.');
  }
  if (minGuestCount !== undefined && maxGuestCount !== undefined && maxGuestCount < minGuestCount) {
    throw new BadRequestException('El máximo de invitados debe ser mayor o igual al mínimo.');
  }
}

function validatePackageGuestRange(minGuestCount?: number, maxGuestCount?: number): void {
  if (minGuestCount !== undefined && maxGuestCount !== undefined && maxGuestCount < minGuestCount) {
    throw new BadRequestException('El máximo de invitados debe ser mayor o igual al mínimo.');
  }
}

function validatePackageLine(line: NonNullable<CreateEventPackageDto['lines']>[number]): void {
  if (
    (line.lineType === EventQuoteLineType.Menu || line.lineType === EventQuoteLineType.Beverage) &&
    !line.menuItemVariantId
  ) {
    throw new BadRequestException('Las líneas de menú o bebida requieren una variante.');
  }
}
