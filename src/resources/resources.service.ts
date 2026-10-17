import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RequestMetadata } from '../auth/auth.types.js';
import type {
  CreateResourceDto,
  UpdateResourceDto,
  ResourceListQueryDto,
  CreateMaintenanceScheduleDto,
  CompleteMaintenanceDto,
} from './dto/resource.dto.js';
import type {
  ResourceResponseDto,
  ResourcePageDto,
  MaintenanceScheduleResponseDto,
} from './dto/resource-response.dto.js';

const resourceInclude = {
  supplier: { select: { name: true } },
} as const satisfies Prisma.ResourceInclude;

type ResourceRow = Prisma.ResourceGetPayload<{ include: typeof resourceInclude }>;

/** Gestiona recursos de equipo, mobiliario e insumos no comestibles. */
@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async listResources(query: ResourceListQueryDto): Promise<ResourcePageDto> {
    await this.requireLocation(query.locationId);
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        include: resourceInclude,
        orderBy: [{ resourceCode: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getResource(id: string, locationId: string): Promise<ResourceResponseDto> {
    const row = await this.prisma.resource.findFirst({
      where: { id, locationId },
      include: resourceInclude,
    });
    if (!row) throw new NotFoundException('Recurso no encontrado.');
    return this.toResponse(row);
  }

  async createResource(
    dto: CreateResourceDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<ResourceResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.requireLocation(dto.locationId, tx);
      await this.assertResourceCodeAvailable(dto.locationId, dto.resourceCode, tx);

      if (dto.supplierId) {
        await this.requireSupplier(dto.supplierId, dto.locationId, tx);
      }

      const created = await tx.resource.create({
        data: {
          locationId: dto.locationId,
          resourceCode: dto.resourceCode,
          name: dto.name,
          category: dto.category,
          location: dto.location || null,
          status: dto.status || 'Operational',
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          cost: dto.cost ? new Prisma.Decimal(dto.cost) : null,
          supplierId: dto.supplierId || null,
          notes: dto.notes || null,
          active: dto.active,
        },
        include: resourceInclude,
      });

      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'resource.created',
        entityType: 'resource',
        entityId: created.id,
        afterData: { resourceCode: created.resourceCode, name: created.name },
      });

      return created;
    });

    return this.toResponse(row);
  }

  async updateResource(
    id: string,
    locationId: string,
    dto: UpdateResourceDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<ResourceResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.resource.findFirst({
        where: { id, locationId },
        include: resourceInclude,
      });
      if (!current) throw new NotFoundException('Recurso no encontrado.');

      const nextCode = dto.resourceCode ?? current.resourceCode;
      await this.assertResourceCodeAvailable(locationId, nextCode, tx, id);

      if (dto.supplierId) {
        await this.requireSupplier(dto.supplierId, locationId, tx);
      }

      const result = await tx.resource.updateMany({
        where: { id, locationId },
        data: {
          ...(dto.resourceCode === undefined ? {} : { resourceCode: dto.resourceCode }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.category === undefined ? {} : { category: dto.category }),
          ...(dto.location === undefined ? {} : { location: dto.location || null }),
          ...(dto.status === undefined ? {} : { status: dto.status }),
          ...(dto.purchaseDate === undefined
            ? {}
            : { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null }),
          ...(dto.cost === undefined
            ? {}
            : { cost: dto.cost ? new Prisma.Decimal(dto.cost) : null }),
          ...(dto.supplierId === undefined ? {} : { supplierId: dto.supplierId || null }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes || null }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
          updatedAt: new Date(),
        },
      });

      if (result.count !== 1) throw new NotFoundException('Recurso no encontrado.');

      const updated = await tx.resource.findFirstOrThrow({
        where: { id, locationId },
        include: resourceInclude,
      });

      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'resource.updated',
        entityType: 'resource',
        entityId: id,
        beforeData: { resourceCode: current.resourceCode, active: current.active },
        afterData: { resourceCode: updated.resourceCode, active: updated.active },
      });

      return updated;
    });

    return this.toResponse(row);
  }

  async scheduleMaintenance(
    dto: CreateMaintenanceScheduleDto,
  ): Promise<MaintenanceScheduleResponseDto> {
    const schedule = await this.prisma.resourceMaintenanceSchedule.create({
      data: {
        resourceId: dto.resourceId,
        scheduledDate: new Date(dto.scheduledDate),
        description: dto.description,
        notes: dto.notes || null,
      },
    });

    return this.toMaintenanceResponse(schedule);
  }

  async completeMaintenance(
    scheduleId: string,
    dto: CompleteMaintenanceDto,
    actorUserId: string,
  ): Promise<MaintenanceScheduleResponseDto> {
    const schedule = await this.prisma.resourceMaintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        completed: true,
        completedAt: new Date(),
        completedByUserId: actorUserId,
        notes: dto.notes || null,
      },
    });

    return this.toMaintenanceResponse(schedule);
  }

  private buildWhere(query: ResourceListQueryDto): Prisma.ResourceWhereInput {
    return {
      locationId: query.locationId,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { resourceCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async requireLocation(
    locationId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const location = await client.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private async requireSupplier(
    supplierId: string,
    locationId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const supplier = await client.supplier.findFirst({
      where: { id: supplierId, locationId, active: true },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado para la sede.');
  }

  private async assertResourceCodeAvailable(
    locationId: string,
    resourceCode: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    ignoredId?: string,
  ): Promise<void> {
    const duplicate = await client.resource.findFirst({
      where: {
        locationId,
        resourceCode,
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('El código de recurso ya existe en la sede.');
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    metadata: RequestMetadata,
    event: {
      action: string;
      entityType: string;
      entityId?: string;
      beforeData?: Prisma.InputJsonObject;
      afterData?: Prisma.InputJsonObject;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        beforeData: event.beforeData,
        afterData: event.afterData,
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
      },
    });
  }

  private toResponse(row: ResourceRow): ResourceResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      resourceCode: row.resourceCode,
      name: row.name,
      category: row.category,
      location: row.location,
      status: row.status,
      purchaseDate: row.purchaseDate?.toISOString().slice(0, 10) ?? null,
      cost: row.cost?.toString() ?? null,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      notes: row.notes,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMaintenanceResponse(
    row: Prisma.ResourceMaintenanceScheduleGetPayload<Record<string, never>>,
  ): MaintenanceScheduleResponseDto {
    return {
      id: row.id,
      resourceId: row.resourceId,
      scheduledDate: row.scheduledDate.toISOString().slice(0, 10),
      description: row.description,
      completed: row.completed,
      completedAt: row.completedAt?.toISOString() ?? null,
      completedByUserId: row.completedByUserId,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
