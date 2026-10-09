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
  EventSpaceBookingStatus,
  EventStatus,
  ReservationSource,
  ReservationStatus,
  ReservationTableStatus,
} from '../generated/prisma/enums.js';
import {
  AssignReservationTablesDto,
  CreateAdminReservationDto,
  CreateDiningTableDto,
  CreatePublicReservationDto,
  CreateVenueSpaceDto,
  ReservationAvailabilityQueryDto,
  ReservationListQueryDto,
  UpdateDiningTableDto,
  UpdateVenueSpaceDto,
  VenueListQueryDto,
} from './dto/reservation.dto.js';
import {
  DiningTableResponseDto,
  PageMetaDto,
  PublicAvailabilityResponseDto,
  PublicReservationResponseDto,
  ReservationPageDto,
  ReservationResponseDto,
  ReservationTableResponseDto,
  VenueSpaceResponseDto,
} from './dto/reservation-response.dto.js';

const reservationTableStatuses = [ReservationTableStatus.Held, ReservationTableStatus.Assigned];
const activeReservationStatuses = [
  ReservationStatus.Requested,
  ReservationStatus.PendingConfirmation,
  ReservationStatus.Confirmed,
  ReservationStatus.Seated,
];

const spaceInclude = {
  diningTables: { orderBy: { tableCode: 'asc' as const } },
} as const;

const reservationInclude = {
  tables: {
    orderBy: { assignedAt: 'asc' as const },
    include: { diningTable: { include: { space: true } } },
  },
  preferredSpace: true,
} as const;

type SpaceRecord = Prisma.VenueSpaceGetPayload<{ include: typeof spaceInclude }>;
type ReservationRecord = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

/** Coordina disponibilidad, solicitudes públicas y operación de reservas de mesa. */
@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcula el intervalo local de El Salvador sin depender de la zona horaria del proceso. */
  async getPublicAvailability(
    query: ReservationAvailabilityQueryDto,
  ): Promise<PublicAvailabilityResponseDto> {
    const location = await this.prisma.location.findFirst({
      where: { id: query.locationId, active: true },
      select: { id: true, timezone: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');

    const startsAt = localDateTime(query.date, query.time);
    const endsAt = new Date(startsAt.getTime() + query.durationMinutes * 60_000);
    const spaces = await this.findAvailabilitySpaces(
      this.prisma,
      query.locationId,
      startsAt,
      endsAt,
      query.partySize,
      query.spaceId,
    );

    return {
      locationId: location.id,
      timezone: location.timezone,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      spaces: spaces.map((space) => ({
        id: space.id,
        code: space.code,
        nameEs: space.nameEs,
        nameEn: space.nameEn,
        seatedCapacity: space.seatedCapacity,
        standingCapacity: space.standingCapacity,
        available: space.available,
      })),
    };
  }

  /** Crea solo una solicitud pública y no asigna mesas ni expone datos internos. */
  async createPublicReservation(
    dto: CreatePublicReservationDto,
  ): Promise<PublicReservationResponseDto> {
    const availability = await this.getPublicAvailability(dto);
    const selected = dto.preferredSpaceId
      ? availability.spaces.find((space) => space.id === dto.preferredSpaceId)
      : availability.spaces.find((space) => space.available);

    if (!selected || !selected.available) {
      throw new ConflictException('No hay disponibilidad para el horario solicitado.');
    }

    const startsAt = new Date(availability.startsAt);
    const endsAt = new Date(availability.endsAt);
    const reservation = await this.prisma.reservation.create({
      data: {
        locationId: dto.locationId,
        reservationCode: this.newReservationCode(),
        contactNameSnapshot: dto.contactName,
        contactPhoneSnapshot: dto.contactPhone,
        contactEmailSnapshot: dto.contactEmail,
        preferredLanguage: dto.preferredLanguage,
        startsAt,
        endsAt,
        partySize: dto.partySize,
        status: ReservationStatus.Requested,
        source: ReservationSource.Web,
        preferredSpaceId: dto.preferredSpaceId,
        specialRequests: dto.specialRequests,
      },
    });

    return this.toPublicReservation(reservation);
  }

  async listReservations(query: ReservationListQueryDto): Promise<ReservationPageDto> {
    const where: Prisma.ReservationWhereInput = {
      locationId: query.locationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startsAt: {
              ...(query.dateFrom ? { gte: localDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lt: nextLocalDate(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.spaceId
        ? {
            OR: [
              { preferredSpaceId: query.spaceId },
              { tables: { some: { diningTable: { spaceId: query.spaceId } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { startsAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toReservation(row)),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async getReservation(id: string): Promise<ReservationResponseDto> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });
    if (!row) throw new NotFoundException('Reserva no encontrada.');
    return this.toReservation(row);
  }

  /** Crea una reserva interna; la reserva y sus mesas se confirman juntas. */
  async createAdminReservation(
    dto: CreateAdminReservationDto,
    createdByUserId?: string,
  ): Promise<ReservationResponseDto> {
    const startsAt = localDateTime(dto.date, dto.time);
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000);

    let reservationId: string;
    try {
      reservationId = await this.prisma.$transaction(async (tx) => {
        const location = await tx.location.findFirst({
          where: { id: dto.locationId, active: true },
          select: { id: true },
        });
        if (!location) throw new NotFoundException('Sede no encontrada.');

        const customer = dto.customerId
          ? await tx.customer.findFirst({
              where: { id: dto.customerId, active: true },
              select: { displayName: true, phone: true, email: true, preferredLanguage: true },
            })
          : null;
        if (dto.customerId && !customer) throw new NotFoundException('Cliente no encontrado.');

        const contactName = dto.contactName || customer?.displayName;
        const contactPhone = dto.contactPhone || customer?.phone;
        if (!contactName)
          throw new BadRequestException('Debe indicar un cliente o nombre de contacto.');
        if (!contactPhone) throw new BadRequestException('Debe indicar un teléfono de contacto.');

        if (dto.preferredSpaceId) {
          const space = await tx.venueSpace.findFirst({
            where: {
              id: dto.preferredSpaceId,
              locationId: dto.locationId,
              active: true,
              allowsTableReservation: true,
            },
            select: { id: true },
          });
          if (!space)
            throw new BadRequestException(
              'El espacio no pertenece a la sede o no está disponible.',
            );
        }

        if (dto.tableIds.length === 0) {
          const spaces = await this.findAvailabilitySpaces(
            tx,
            dto.locationId,
            startsAt,
            endsAt,
            dto.partySize,
            dto.preferredSpaceId,
          );
          if (!spaces.some((space) => space.available)) {
            throw new ConflictException('No hay capacidad disponible para el horario solicitado.');
          }
        }

        const reservation = await tx.reservation.create({
          data: {
            locationId: dto.locationId,
            customerId: dto.customerId,
            reservationCode: this.newReservationCode(),
            contactNameSnapshot: contactName,
            contactPhoneSnapshot: contactPhone,
            contactEmailSnapshot: dto.contactEmail ?? customer?.email,
            preferredLanguage: dto.preferredLanguage ?? customer?.preferredLanguage ?? 'es',
            startsAt,
            endsAt,
            partySize: dto.partySize,
            status: dto.status,
            source: ReservationSource.Admin,
            preferredSpaceId: dto.preferredSpaceId,
            internalNotes: dto.internalNotes,
            createdByUserId,
            ...(dto.status === ReservationStatus.Confirmed ? { confirmedAt: new Date() } : {}),
          },
          select: { id: true, locationId: true, partySize: true, startsAt: true, endsAt: true },
        });

        if (dto.tableIds.length > 0) {
          await this.assignTablesInTransaction(
            tx,
            reservation,
            dto.tableIds,
            createdByUserId,
            dto.preferredSpaceId,
          );
        }
        return reservation.id;
      });
    } catch (error) {
      this.rethrowPrismaConflict(error);
      throw error;
    }

    return this.getReservation(reservationId);
  }

  async transitionReservation(
    id: string,
    target: ReservationStatus,
  ): Promise<ReservationResponseDto> {
    const current = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) throw new NotFoundException('Reserva no encontrada.');

    const allowed = validReservationTransitions[current.status] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(`La reserva no puede pasar de ${current.status} a ${target}.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: {
          status: target,
          ...(target === ReservationStatus.Confirmed ? { confirmedAt: new Date() } : {}),
          ...(target === ReservationStatus.Seated ? { seatedAt: new Date() } : {}),
          ...(target === ReservationStatus.Completed ? { completedAt: new Date() } : {}),
          ...(target === ReservationStatus.Cancelled ? { cancelledAt: new Date() } : {}),
        },
      });

      if (
        target === ReservationStatus.Completed ||
        target === ReservationStatus.Cancelled ||
        target === ReservationStatus.NoShow
      ) {
        await tx.reservationTable.updateMany({
          where: {
            reservationId: id,
            allocationStatus: { in: reservationTableStatuses },
          },
          data: { allocationStatus: ReservationTableStatus.Released },
        });
      }
    });

    return this.getReservation(id);
  }

  async assignTables(
    id: string,
    dto: AssignReservationTablesDto,
    assignedByUserId?: string,
  ): Promise<ReservationResponseDto> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id },
          select: { id: true, locationId: true, partySize: true, startsAt: true, endsAt: true },
        });
        if (!reservation) throw new NotFoundException('Reserva no encontrada.');
        await this.assignTablesInTransaction(tx, reservation, dto.tableIds, assignedByUserId);
      });
    } catch (error) {
      this.rethrowPrismaConflict(error);
    }

    return this.getReservation(id);
  }

  private async assignTablesInTransaction(
    tx: Prisma.TransactionClient,
    reservation: {
      id: string;
      locationId: string;
      partySize: number;
      startsAt: Date;
      endsAt: Date;
    },
    tableIds: string[],
    assignedByUserId?: string,
    preferredSpaceId?: string,
  ): Promise<void> {
    if (tableIds.length === 0) throw new BadRequestException('Debe indicar al menos una mesa.');
    if (new Set(tableIds).size !== tableIds.length) {
      throw new BadRequestException('No puede repetir una mesa.');
    }

    const tables = await tx.diningTable.findMany({
      where: {
        id: { in: tableIds },
        active: true,
        space: {
          locationId: reservation.locationId,
          ...(preferredSpaceId ? { id: preferredSpaceId } : {}),
        },
      },
      select: { id: true, seatCount: true },
    });
    if (tables.length !== tableIds.length) {
      throw new BadRequestException('Una o más mesas no pertenecen a la sede o están inactivas.');
    }
    if (tables.reduce((total, table) => total + table.seatCount, 0) < reservation.partySize) {
      throw new ConflictException('La capacidad de las mesas no cubre el grupo.');
    }

    const conflict = await tx.reservationTable.findFirst({
      where: {
        diningTableId: { in: tableIds },
        reservationId: { not: reservation.id },
        allocationStatus: { in: reservationTableStatuses },
        startsAt: { lt: reservation.endsAt },
        endsAt: { gt: reservation.startsAt },
        reservation: { status: { in: activeReservationStatuses } },
      },
      select: { id: true },
    });
    if (conflict) throw new ConflictException('Una o más mesas ya están asignadas en ese horario.');

    await tx.reservationTable.updateMany({
      where: {
        reservationId: reservation.id,
        allocationStatus: { in: reservationTableStatuses },
      },
      data: { allocationStatus: ReservationTableStatus.Released },
    });
    await tx.reservationTable.createMany({
      data: tableIds.map((diningTableId) => ({
        reservationId: reservation.id,
        diningTableId,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        allocationStatus: ReservationTableStatus.Assigned,
        assignedByUserId,
      })),
    });
  }

  async listSpaces(query: VenueListQueryDto): Promise<VenueSpaceResponseDto[]> {
    const rows = await this.prisma.venueSpace.findMany({
      where: { locationId: query.locationId, ...(query.includeInactive ? {} : { active: true }) },
      include: spaceInclude,
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => this.toSpace(row));
  }

  async getSpace(id: string): Promise<VenueSpaceResponseDto> {
    const row = await this.prisma.venueSpace.findUnique({ where: { id }, include: spaceInclude });
    if (!row) throw new NotFoundException('Espacio no encontrado.');
    return this.toSpace(row);
  }

  async createSpace(dto: CreateVenueSpaceDto): Promise<VenueSpaceResponseDto> {
    try {
      const row = await this.prisma.venueSpace.create({
        data: dto,
        include: spaceInclude,
      });
      return this.toSpace(row);
    } catch (error) {
      this.rethrowPrismaConflict(error);
      throw error;
    }
  }

  async updateSpace(id: string, dto: UpdateVenueSpaceDto): Promise<VenueSpaceResponseDto> {
    try {
      const row = await this.prisma.venueSpace.update({
        where: { id },
        data: dto,
        include: spaceInclude,
      });
      return this.toSpace(row);
    } catch (error) {
      this.rethrowPrismaConflict(error);
      throw error;
    }
  }

  async deleteSpace(id: string): Promise<VenueSpaceResponseDto> {
    try {
      const row = await this.prisma.venueSpace.update({
        where: { id },
        data: { active: false },
        include: spaceInclude,
      });
      return this.toSpace(row);
    } catch (error) {
      if (this.isPrismaCode(error, 'P2025')) throw new NotFoundException('Espacio no encontrado.');
      throw error;
    }
  }

  async listTables(spaceId?: string): Promise<DiningTableResponseDto[]> {
    const rows = await this.prisma.diningTable.findMany({
      where: spaceId ? { spaceId } : undefined,
      orderBy: [{ spaceId: 'asc' }, { tableCode: 'asc' }],
    });
    return rows.map((row) => this.toTable(row));
  }

  async getTable(id: string): Promise<DiningTableResponseDto> {
    const row = await this.prisma.diningTable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Mesa no encontrada.');
    return this.toTable(row);
  }

  async createTable(dto: CreateDiningTableDto): Promise<DiningTableResponseDto> {
    const space = await this.prisma.venueSpace.findUnique({
      where: { id: dto.spaceId },
      select: { id: true },
    });
    if (!space) throw new NotFoundException('Espacio no encontrado.');
    try {
      const row = await this.prisma.diningTable.create({ data: dto });
      return this.toTable(row);
    } catch (error) {
      this.rethrowPrismaConflict(error);
      throw error;
    }
  }

  async updateTable(id: string, dto: UpdateDiningTableDto): Promise<DiningTableResponseDto> {
    try {
      const row = await this.prisma.diningTable.update({ where: { id }, data: dto });
      return this.toTable(row);
    } catch (error) {
      if (this.isPrismaCode(error, 'P2025')) throw new NotFoundException('Mesa no encontrada.');
      this.rethrowPrismaConflict(error);
      throw error;
    }
  }

  async deleteTable(id: string): Promise<DiningTableResponseDto> {
    return this.updateTable(id, { active: false });
  }

  private async findAvailabilitySpaces(
    client: PrismaService | Prisma.TransactionClient,
    locationId: string,
    startsAt: Date,
    endsAt: Date,
    partySize: number,
    spaceId?: string,
  ): Promise<Array<SpaceRecord & { available: boolean }>> {
    const rows = await client.venueSpace.findMany({
      where: {
        locationId,
        active: true,
        allowsTableReservation: true,
        ...(spaceId ? { id: spaceId } : {}),
      },
      include: {
        diningTables: {
          where: { active: true },
          include: {
            reservationTables: {
              where: {
                allocationStatus: { in: reservationTableStatuses },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
                reservation: { status: { in: activeReservationStatuses } },
              },
              select: { id: true },
            },
          },
          orderBy: { tableCode: 'asc' },
        },
        eventBookings: {
          where: {
            bookingStatus: {
              in: [EventSpaceBookingStatus.Held, EventSpaceBookingStatus.Confirmed],
            },
            event: { status: { notIn: [EventStatus.Cancelled, EventStatus.Lost] } },
          },
          select: {
            startsAt: true,
            endsAt: true,
            setupStartsAt: true,
            teardownEndsAt: true,
            bookingStatus: true,
            holdExpiresAt: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return rows.map((space) => {
      const eventBlocked = space.eventBookings.some((booking) => {
        if (
          booking.bookingStatus === 'Held' &&
          booking.holdExpiresAt &&
          booking.holdExpiresAt <= new Date()
        ) {
          return false;
        }
        const blockedStart = booking.setupStartsAt ?? booking.startsAt;
        const blockedEnd = booking.teardownEndsAt ?? booking.endsAt;
        return blockedStart < endsAt && blockedEnd > startsAt;
      });
      const freeCapacity = space.diningTables
        .filter((table) => table.reservationTables.length === 0)
        .reduce((total, table) => total + table.seatCount, 0);
      return { ...space, available: !eventBlocked && freeCapacity >= partySize };
    });
  }

  private toSpace(row: SpaceRecord): VenueSpaceResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      code: row.code,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      spaceType: row.spaceType,
      seatedCapacity: row.seatedCapacity,
      standingCapacity: row.standingCapacity,
      allowsTableReservation: row.allowsTableReservation,
      allowsPrivateEvent: row.allowsPrivateEvent,
      active: row.active,
      tableCount: row.diningTables.length,
    };
  }

  private toTable(row: {
    id: string;
    spaceId: string;
    tableCode: string;
    name: string;
    seatCount: number;
    shape: string;
    active: boolean;
  }): DiningTableResponseDto {
    return { ...row };
  }

  private toPublicReservation(row: {
    reservationCode: string;
    status: ReservationStatus;
    startsAt: Date;
    endsAt: Date;
    partySize: number;
  }): PublicReservationResponseDto {
    return {
      reservationCode: row.reservationCode,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      partySize: row.partySize,
    };
  }

  private toReservation(row: ReservationRecord): ReservationResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      reservationCode: row.reservationCode,
      contactNameSnapshot: row.contactNameSnapshot,
      contactPhoneSnapshot: row.contactPhoneSnapshot,
      contactEmailSnapshot: row.contactEmailSnapshot,
      preferredLanguage: row.preferredLanguage,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      partySize: row.partySize,
      status: row.status,
      source: row.source,
      preferredSpaceId: row.preferredSpaceId,
      specialRequests: row.specialRequests,
      internalNotes: row.internalNotes,
      tables: row.tables.map((table): ReservationTableResponseDto => ({
        reservationTableId: table.id,
        id: table.diningTable.id,
        spaceId: table.diningTable.spaceId,
        tableCode: table.diningTable.tableCode,
        name: table.diningTable.name,
        seatCount: table.diningTable.seatCount,
        shape: table.diningTable.shape,
        active: table.diningTable.active,
        allocationStatus: table.allocationStatus,
        startsAt: table.startsAt.toISOString(),
        endsAt: table.endsAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private newReservationCode(): string {
    return `RES-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private rethrowPrismaConflict(error: unknown): void {
    if (this.isPrismaCode(error, 'P2002'))
      throw new ConflictException('El recurso ya existe o está ocupado.');
    if (this.isPrismaCode(error, 'P2025')) throw new NotFoundException('El recurso no existe.');
  }

  private isPrismaCode(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}

const validReservationTransitions: Record<ReservationStatus, readonly ReservationStatus[]> = {
  [ReservationStatus.Requested]: [
    ReservationStatus.PendingConfirmation,
    ReservationStatus.Confirmed,
    ReservationStatus.Cancelled,
  ],
  [ReservationStatus.PendingConfirmation]: [
    ReservationStatus.Confirmed,
    ReservationStatus.Cancelled,
  ],
  [ReservationStatus.Confirmed]: [
    ReservationStatus.Seated,
    ReservationStatus.Cancelled,
    ReservationStatus.NoShow,
  ],
  [ReservationStatus.Seated]: [ReservationStatus.Completed, ReservationStatus.Cancelled],
  [ReservationStatus.Completed]: [],
  [ReservationStatus.Cancelled]: [],
  [ReservationStatus.NoShow]: [],
  [ReservationStatus.Expired]: [],
};

function localDateTime(date: string, time: string): Date {
  const result = new Date(`${date}T${time}:00-06:00`);
  if (Number.isNaN(result.getTime())) throw new BadRequestException('Fecha u hora local inválida.');
  return result;
}

function localDate(date: string): Date {
  return localDateTime(date, '00:00');
}

function nextLocalDate(date: string): Date {
  const result = localDate(date);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function pageMeta(page: number, pageSize: number, total: number): PageMetaDto {
  return { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
}
