import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { InventoryMovementType } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import type { RequestMetadata } from '../auth/auth.types.js';
import type {
  CreateGoodsReceiptDto,
  CreateIngredientDto,
  CreateInventoryAdjustmentDto,
  CreateRecipeDto,
  CreateSupplierDto,
  GoodsReceiptListQueryDto,
  IngredientListQueryDto,
  IngredientSupplierInputDto,
  InventoryAlertQueryDto,
  InventoryMovementListQueryDto,
  RecipeListQueryDto,
  StorageLocationListQueryDto,
  SupplierListQueryDto,
  UpdateIngredientDto,
  UpdateRecipeDto,
  UpdateSupplierDto,
} from './dto/inventory.dto.js';
import type {
  ExpiringLotAlertDto,
  GoodsReceiptListItemDto,
  GoodsReceiptPageDto,
  GoodsReceiptResponseDto,
  IngredientCategoryResponseDto,
  IngredientPageDto,
  IngredientResponseDto,
  InventoryAlertsResponseDto,
  InventoryMovementPageDto,
  InventoryMovementResponseDto,
  InventoryPageMetaDto,
  LowStockAlertDto,
  RecipePageDto,
  RecipeResponseDto,
  StorageLocationResponseDto,
  SupplierPageDto,
  SupplierResponseDto,
  UnitResponseDto,
} from './dto/inventory-response.dto.js';

const supplierInclude = {
  _count: { select: { ingredientLinks: true } },
} as const satisfies Prisma.SupplierInclude;

const ingredientInclude = {
  category: { select: { id: true, name: true } },
  baseUnit: { select: { id: true, code: true, name: true } },
  supplierLinks: {
    orderBy: { supplierId: 'asc' },
    select: {
      supplierId: true,
      supplierSku: true,
      packQuantity: true,
      packUnitId: true,
      unitCost: true,
      isPreferred: true,
      supplier: { select: { name: true } },
      packUnit: { select: { code: true } },
    },
  },
} as const satisfies Prisma.IngredientInclude;

const receiptDetailInclude = {
  supplier: { select: { name: true } },
  lines: {
    orderBy: { id: 'asc' },
    include: {
      ingredient: { select: { name: true } },
      unit: { select: { code: true } },
      inventoryLot: {
        select: {
          id: true,
          lotCode: true,
          storageLocationId: true,
          receivedOn: true,
          expiresOn: true,
        },
      },
    },
  },
} as const satisfies Prisma.GoodsReceiptInclude;

const receiptListInclude = {
  supplier: { select: { name: true } },
  lines: { select: { id: true } },
} as const satisfies Prisma.GoodsReceiptInclude;

const movementInclude = {
  storageLocation: { select: { code: true } },
  ingredient: { select: { name: true } },
  inventoryLot: { select: { lotCode: true } },
} as const satisfies Prisma.InventoryMovementInclude;

const recipeInclude = {
  menuItemVariant: {
    select: {
      sku: true,
      nameEs: true,
      menuItem: { select: { sku: true, nameEs: true } },
    },
  },
  yieldUnit: { select: { id: true, code: true } },
  lines: {
    orderBy: { id: 'asc' },
    include: {
      ingredient: { select: { name: true, sku: true } },
      unit: { select: { code: true } },
    },
  },
} as const satisfies Prisma.RecipeInclude;

type SupplierRow = Prisma.SupplierGetPayload<{ include: typeof supplierInclude }>;
type IngredientRow = Prisma.IngredientGetPayload<{ include: typeof ingredientInclude }>;
type ReceiptDetailRow = Prisma.GoodsReceiptGetPayload<{ include: typeof receiptDetailInclude }>;
type ReceiptListRow = Prisma.GoodsReceiptGetPayload<{ include: typeof receiptListInclude }>;
type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;
type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;
type DbClient = PrismaService | Prisma.TransactionClient;
type AuditData = Prisma.InputJsonObject;

/** Coordina el libro mayor de inventario y los catálogos que lo alimentan. */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listUnits(): Promise<UnitResponseDto[]> {
    const rows = await this.prisma.unit.findMany({
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      precisionScale: row.precisionScale,
      active: row.active,
    }));
  }

  async listIngredientCategories(): Promise<IngredientCategoryResponseDto[]> {
    const rows = await this.prisma.ingredientCategory.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({ id: row.id, name: row.name, active: row.active }));
  }

  async listStorageLocations(
    query: StorageLocationListQueryDto,
  ): Promise<StorageLocationResponseDto[]> {
    await this.requireLocation(this.prisma, query.locationId);
    const rows = await this.prisma.storageLocation.findMany({
      where: {
        locationId: query.locationId,
        ...(query.includeInactive ? {} : { active: true }),
      },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      locationId: row.locationId,
      code: row.code,
      name: row.name,
      active: row.active,
    }));
  }

  async listSuppliers(query: SupplierListQueryDto): Promise<SupplierPageDto> {
    await this.requireLocation(this.prisma, query.locationId);
    const where = this.supplierWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: supplierInclude,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
      }),
    ]);
    return {
      data: rows.map((row) => this.toSupplier(row)),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async getSupplier(id: string): Promise<SupplierResponseDto> {
    const row = await this.prisma.supplier.findUnique({ where: { id }, include: supplierInclude });
    if (!row) throw new NotFoundException('Proveedor no encontrado.');
    return this.toSupplier(row);
  }

  async createSupplier(
    dto: CreateSupplierDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<SupplierResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.requireLocation(tx, dto.locationId);
      await this.assertSupplierCodeAvailable(tx, dto.locationId, dto.supplierCode);
      const created = await tx.supplier.create({
        data: {
          locationId: dto.locationId,
          supplierCode: dto.supplierCode,
          name: dto.name,
          taxId: dto.taxId || null,
          phone: dto.phone || null,
          email: dto.email || null,
          addressLine: dto.addressLine || null,
          active: dto.active,
        },
        include: supplierInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'supplier.created',
        entityType: 'supplier',
        entityId: created.id,
        afterData: this.supplierAuditData(created),
      });
      return created;
    });
    return this.toSupplier(row);
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<SupplierResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.supplier.findUnique({ where: { id }, include: supplierInclude });
      if (!current) throw new NotFoundException('Proveedor no encontrado.');
      const nextCode = dto.supplierCode ?? current.supplierCode;
      await this.assertSupplierCodeAvailable(tx, current.locationId, nextCode, id);
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          ...(dto.supplierCode === undefined ? {} : { supplierCode: dto.supplierCode }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.taxId === undefined ? {} : { taxId: dto.taxId || null }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone || null }),
          ...(dto.email === undefined ? {} : { email: dto.email || null }),
          ...(dto.addressLine === undefined ? {} : { addressLine: dto.addressLine || null }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
          updatedAt: new Date(),
        },
        include: supplierInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'supplier.updated',
        entityType: 'supplier',
        entityId: id,
        beforeData: this.supplierAuditData(current),
        afterData: this.supplierAuditData(updated),
      });
      return updated;
    });
    return this.toSupplier(row);
  }

  async removeSupplier(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<SupplierResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.supplier.findUnique({ where: { id }, include: supplierInclude });
      if (!current) throw new NotFoundException('Proveedor no encontrado.');
      const updated = await tx.supplier.update({
        where: { id },
        data: { active: false, updatedAt: new Date() },
        include: supplierInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'supplier.deactivated',
        entityType: 'supplier',
        entityId: id,
        beforeData: this.supplierAuditData(current),
        afterData: this.supplierAuditData(updated),
      });
      return updated;
    });
    return this.toSupplier(row);
  }

  async listIngredients(query: IngredientListQueryDto): Promise<IngredientPageDto> {
    await this.requireLocation(this.prisma, query.locationId);
    if (query.storageLocationId) {
      await this.requireStorageLocation(this.prisma, query.storageLocationId, query.locationId);
    }
    const where = this.ingredientWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ingredient.count({ where }),
      this.prisma.ingredient.findMany({
        where,
        include: ingredientInclude,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
      }),
    ]);
    const stocks = await this.stockByIngredient(
      this.prisma,
      query.locationId,
      rows.map((row) => row.id),
      query.storageLocationId,
    );
    return {
      data: rows.map((row) => this.toIngredient(row, stocks.get(row.id) ?? new Prisma.Decimal(0))),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async getIngredient(id: string, locationId: string): Promise<IngredientResponseDto> {
    await this.requireLocation(this.prisma, locationId);
    const row = await this.prisma.ingredient.findUnique({
      where: { id },
      include: ingredientInclude,
    });
    if (!row) throw new NotFoundException('Ingrediente no encontrado.');
    const stocks = await this.stockByIngredient(this.prisma, locationId, [id]);
    return this.toIngredient(row, stocks.get(id) ?? new Prisma.Decimal(0));
  }

  async createIngredient(
    dto: CreateIngredientDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<IngredientResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.requireCategoryAndUnit(tx, dto.categoryId, dto.baseUnitId);
      await this.assertIngredientIdentityAvailable(tx, dto.sku, dto.name);
      const created = await tx.ingredient.create({
        data: {
          categoryId: dto.categoryId,
          baseUnitId: dto.baseUnitId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description || null,
          reorderLevel: nonNegativeDecimal(dto.reorderLevel, 'El stock mínimo'),
          trackLots: dto.trackLots,
          active: dto.active,
        },
        include: ingredientInclude,
      });
      if (dto.supplierLinks !== undefined) {
        await this.replaceSupplierLinks(tx, created.id, dto.supplierLinks);
      }
      const result = await tx.ingredient.findUniqueOrThrow({
        where: { id: created.id },
        include: ingredientInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'ingredient.created',
        entityType: 'ingredient',
        entityId: created.id,
        afterData: this.ingredientAuditData(result),
      });
      return result;
    });
    return this.toIngredient(row, new Prisma.Decimal(0));
  }

  async updateIngredient(
    id: string,
    dto: UpdateIngredientDto,
    locationId: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<IngredientResponseDto> {
    await this.requireLocation(this.prisma, locationId);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.ingredient.findUnique({ where: { id }, include: ingredientInclude });
      if (!current) throw new NotFoundException('Ingrediente no encontrado.');
      if (dto.categoryId || dto.baseUnitId) {
        await this.requireCategoryAndUnit(
          tx,
          dto.categoryId ?? current.categoryId,
          dto.baseUnitId ?? current.baseUnitId,
        );
      }
      if (dto.sku !== undefined || dto.name !== undefined) {
        await this.assertIngredientIdentityAvailable(
          tx,
          dto.sku ?? current.sku,
          dto.name ?? current.name,
          id,
        );
      }
      if (dto.baseUnitId && dto.baseUnitId !== current.baseUnitId) {
        const [movementCount, recipeLineCount, receiptLineCount] = await Promise.all([
          tx.inventoryMovement.count({ where: { ingredientId: id } }),
          tx.recipeLine.count({ where: { ingredientId: id } }),
          tx.goodsReceiptLine.count({ where: { ingredientId: id } }),
        ]);
        if (movementCount > 0 || recipeLineCount > 0 || receiptLineCount > 0) {
          throw new ConflictException(
            'No puede cambiar la unidad base de un ingrediente con historial operativo.',
          );
        }
      }
      if (dto.supplierLinks !== undefined) {
        await this.replaceSupplierLinks(tx, id, dto.supplierLinks);
      }
      await tx.ingredient.update({
        where: { id },
        data: {
          ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
          ...(dto.baseUnitId === undefined ? {} : { baseUnitId: dto.baseUnitId }),
          ...(dto.sku === undefined ? {} : { sku: dto.sku }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.description === undefined ? {} : { description: dto.description || null }),
          ...(dto.reorderLevel === undefined
            ? {}
            : { reorderLevel: nonNegativeDecimal(dto.reorderLevel, 'El stock mínimo') }),
          ...(dto.trackLots === undefined ? {} : { trackLots: dto.trackLots }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
          updatedAt: new Date(),
        },
      });
      const updated = await tx.ingredient.findUniqueOrThrow({
        where: { id },
        include: ingredientInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'ingredient.updated',
        entityType: 'ingredient',
        entityId: id,
        beforeData: this.ingredientAuditData(current),
        afterData: this.ingredientAuditData(updated),
      });
      return updated;
    });
    const stocks = await this.stockByIngredient(this.prisma, locationId, [id]);
    return this.toIngredient(row, stocks.get(id) ?? new Prisma.Decimal(0));
  }

  async removeIngredient(
    id: string,
    locationId: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<IngredientResponseDto> {
    await this.requireLocation(this.prisma, locationId);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.ingredient.findUnique({ where: { id }, include: ingredientInclude });
      if (!current) throw new NotFoundException('Ingrediente no encontrado.');
      const updated = await tx.ingredient.update({
        where: { id },
        data: { active: false, updatedAt: new Date() },
        include: ingredientInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'ingredient.deactivated',
        entityType: 'ingredient',
        entityId: id,
        beforeData: this.ingredientAuditData(current),
        afterData: this.ingredientAuditData(updated),
      });
      return updated;
    });
    const stocks = await this.stockByIngredient(this.prisma, locationId, [id]);
    return this.toIngredient(row, stocks.get(id) ?? new Prisma.Decimal(0));
  }

  async listReceipts(query: GoodsReceiptListQueryDto): Promise<GoodsReceiptPageDto> {
    await this.requireLocation(this.prisma, query.locationId);
    const where: Prisma.GoodsReceiptWhereInput = {
      locationId: query.locationId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            receivedAt: {
              ...(query.dateFrom ? { gte: startOfDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lt: startOfNextDate(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { receiptNumber: { contains: query.search, mode: 'insensitive' } },
              { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.goodsReceipt.count({ where }),
      this.prisma.goodsReceipt.findMany({
        where,
        include: receiptListInclude,
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
    ]);
    return {
      data: rows.map((row) => this.toReceiptListItem(row)),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async getReceipt(id: string): Promise<GoodsReceiptResponseDto> {
    const row = await this.findReceiptDetail(this.prisma, id);
    if (!row) throw new NotFoundException('Recepción no encontrada.');
    return this.toReceipt(row);
  }

  async createReceipt(
    dto: CreateGoodsReceiptDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<GoodsReceiptResponseDto> {
    validateReceiptLines(dto);
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockStorageLocation(tx, dto.storageLocationId, dto.locationId);
      const existing = await tx.goodsReceipt.findUnique({
        where: {
          locationId_receiptNumber: {
            locationId: dto.locationId,
            receiptNumber: dto.receiptNumber,
          },
        },
        select: { id: true, supplierId: true },
      });
      if (existing) {
        if (existing.supplierId !== dto.supplierId) {
          throw new ConflictException('El número de recepción ya pertenece a otro proveedor.');
        }
        const idempotent = await this.findReceiptDetail(tx, existing.id);
        if (!idempotent) throw new NotFoundException('Recepción no encontrada.');
        return idempotent;
      }

      await this.requireSupplierForLocation(tx, dto.supplierId, dto.locationId);
      const storageLocation = await this.requireStorageLocation(
        tx,
        dto.storageLocationId,
        dto.locationId,
      );
      const ingredients = await tx.ingredient.findMany({
        where: { id: { in: dto.lines.map((line) => line.ingredientId) }, active: true },
        select: { id: true, baseUnitId: true },
      });
      const units = await tx.unit.findMany({
        where: { id: { in: dto.lines.map((line) => line.unitId) }, active: true },
        select: { id: true },
      });
      const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
      const unitIds = new Set(units.map((unit) => unit.id));
      for (const line of dto.lines) {
        const ingredient = ingredientById.get(line.ingredientId);
        if (!ingredient)
          throw new NotFoundException('Uno de los ingredientes no existe o está inactivo.');
        if (!unitIds.has(line.unitId))
          throw new NotFoundException('Una unidad de recepción no existe o está inactiva.');
        if (ingredient.baseUnitId !== line.unitId) {
          throw new BadRequestException(
            'La recepción debe expresar cada cantidad en la unidad base del ingrediente.',
          );
        }
        const receivedOn = startOfDate(line.receivedOn);
        const expiresOn = line.expiresOn ? startOfDate(line.expiresOn) : null;
        if (expiresOn && expiresOn <= receivedOn) {
          throw new BadRequestException('El vencimiento debe ser posterior a la recepción.');
        }
      }

      const receipt = await tx.goodsReceipt.create({
        data: {
          locationId: dto.locationId,
          supplierId: dto.supplierId,
          receiptNumber: dto.receiptNumber,
          receivedAt: new Date(dto.receivedAt),
          receivedByUserId: actorUserId,
          notes: dto.notes || null,
        },
        select: { id: true },
      });

      for (const line of dto.lines) {
        const quantity = positiveDecimal(line.quantityReceived, 'La cantidad recibida');
        const unitCost = nonNegativeDecimal(line.unitCost, 'El costo unitario');
        const lot = await tx.inventoryLot.create({
          data: {
            storageLocationId: storageLocation.id,
            ingredientId: line.ingredientId,
            supplierId: dto.supplierId,
            lotCode: line.lotCode,
            receivedOn: startOfDate(line.receivedOn),
            expiresOn: line.expiresOn ? startOfDate(line.expiresOn) : null,
            quantityReceived: quantity,
            unitCost,
          },
          select: { id: true },
        });
        const receiptLine = await tx.goodsReceiptLine.create({
          data: {
            goodsReceiptId: receipt.id,
            ingredientId: line.ingredientId,
            inventoryLotId: lot.id,
            unitId: line.unitId,
            quantityReceived: quantity,
            unitCost,
            totalCost: quantity.mul(unitCost).toDecimalPlaces(2),
          },
          select: { id: true },
        });
        await tx.inventoryMovement.create({
          data: {
            storageLocationId: storageLocation.id,
            ingredientId: line.ingredientId,
            inventoryLotId: lot.id,
            movementType: InventoryMovementType.Receipt,
            quantityDelta: quantity,
            unitCost,
            goodsReceiptLineId: receiptLine.id,
            createdByUserId: actorUserId,
            reason: `Recepción ${dto.receiptNumber}`,
          },
        });
      }

      const created = await this.findReceiptDetail(tx, receipt.id);
      if (!created) throw new NotFoundException('No se pudo recuperar la recepción creada.');
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'goods_receipt.created',
        entityType: 'goods_receipt',
        entityId: receipt.id,
        afterData: {
          locationId: dto.locationId,
          supplierId: dto.supplierId,
          receiptNumber: dto.receiptNumber,
          lineCount: dto.lines.length,
        },
      });
      return created;
    });
    return this.toReceipt(row);
  }

  async listMovements(query: InventoryMovementListQueryDto): Promise<InventoryMovementPageDto> {
    await this.requireLocation(this.prisma, query.locationId);
    if (query.storageLocationId) {
      await this.requireStorageLocation(this.prisma, query.storageLocationId, query.locationId);
    }
    const where: Prisma.InventoryMovementWhereInput = {
      storageLocation: { locationId: query.locationId },
      ...(query.storageLocationId ? { storageLocationId: query.storageLocationId } : {}),
      ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      ...(query.movementType ? { movementType: query.movementType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: startOfDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lt: startOfNextDate(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
      }),
    ]);
    return {
      data: rows.map((row) => this.toMovement(row)),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async createAdjustment(
    dto: CreateInventoryAdjustmentDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<InventoryMovementResponseDto> {
    const adjustmentTypes: InventoryMovementType[] = [
      InventoryMovementType.AdjustmentIn,
      InventoryMovementType.AdjustmentOut,
      InventoryMovementType.Waste,
    ];
    if (!adjustmentTypes.includes(dto.movementType)) {
      throw new BadRequestException('El tipo de movimiento no es un ajuste o una merma.');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockStorageLocation(tx, dto.storageLocationId, dto.locationId);
      if (dto.operationId) {
        const previous = await tx.inventoryMovement.findUnique({
          where: { id: dto.operationId },
          select: { id: true, storageLocationId: true, movementType: true },
        });
        if (previous) {
          if (
            previous.storageLocationId !== dto.storageLocationId ||
            previous.movementType !== dto.movementType
          ) {
            throw new ConflictException('El operationId ya fue usado para otro movimiento.');
          }
          const idempotent = await this.findMovement(tx, previous.id);
          if (!idempotent) throw new NotFoundException('Movimiento no encontrado.');
          return idempotent;
        }
      }
      const storage = await this.requireStorageLocation(tx, dto.storageLocationId, dto.locationId);
      const ingredient = await tx.ingredient.findUnique({
        where: { id: dto.ingredientId },
        select: { id: true, active: true },
      });
      if (!ingredient || !ingredient.active)
        throw new NotFoundException('Ingrediente no encontrado o inactivo.');
      if (dto.inventoryLotId) {
        const lot = await tx.inventoryLot.findFirst({
          where: {
            id: dto.inventoryLotId,
            ingredientId: dto.ingredientId,
            storageLocationId: dto.storageLocationId,
            active: true,
          },
          select: { id: true },
        });
        if (!lot)
          throw new NotFoundException('Lote no encontrado para el ingrediente y la bodega.');
      }
      const quantity = positiveDecimal(dto.quantity, 'La cantidad del ajuste');
      const unitCost = nonNegativeDecimal(dto.unitCost, 'El costo unitario');
      const sign =
        dto.movementType === InventoryMovementType.AdjustmentIn
          ? new Prisma.Decimal(1)
          : new Prisma.Decimal(-1);
      const delta = quantity.mul(sign);
      const stockBefore = await this.stockForIngredient(
        tx,
        dto.storageLocationId,
        dto.ingredientId,
      );
      const stockAfter = stockBefore.add(delta);
      if (stockAfter.isNegative()) {
        throw new ConflictException('La operación dejaría el stock por debajo de cero.');
      }
      const movement = await tx.inventoryMovement.create({
        data: {
          ...(dto.operationId ? { id: dto.operationId } : {}),
          storageLocationId: storage.id,
          ingredientId: dto.ingredientId,
          inventoryLotId: dto.inventoryLotId || null,
          movementType: dto.movementType,
          quantityDelta: delta,
          unitCost,
          createdByUserId: actorUserId,
          reason: dto.reason,
        },
        select: { id: true },
      });
      const created = await this.findMovement(tx, movement.id);
      if (!created) throw new NotFoundException('No se pudo recuperar el movimiento creado.');
      await this.writeAudit(tx, actorUserId, metadata, {
        action:
          dto.movementType === InventoryMovementType.Waste
            ? 'inventory.waste.created'
            : 'inventory.adjustment.created',
        entityType: 'inventory_movement',
        entityId: movement.id,
        beforeData: { stock: stockBefore.toString() },
        afterData: {
          stock: stockAfter.toString(),
          movementType: dto.movementType,
          quantityDelta: delta.toString(),
          reason: dto.reason,
        },
      });
      return created;
    });
    return this.toMovement(row);
  }

  async listAlerts(query: InventoryAlertQueryDto): Promise<InventoryAlertsResponseDto> {
    await this.requireLocation(this.prisma, query.locationId);
    const ingredients = await this.prisma.ingredient.findMany({
      where: { active: true },
      include: ingredientInclude,
      orderBy: { name: 'asc' },
    });
    const stocks = await this.stockByIngredient(
      this.prisma,
      query.locationId,
      ingredients.map((ingredient) => ingredient.id),
    );
    const lowStock: LowStockAlertDto[] = ingredients
      .map((ingredient) => {
        const currentStock = stocks.get(ingredient.id) ?? new Prisma.Decimal(0);
        return {
          ingredientId: ingredient.id,
          sku: ingredient.sku,
          name: ingredient.name,
          baseUnitCode: ingredient.baseUnit.code,
          currentStock: currentStock.toString(),
          reorderLevel: ingredient.reorderLevel.toString(),
          lowStock: currentStock.lte(ingredient.reorderLevel),
        };
      })
      .filter((row) => row.lowStock)
      .map((row) => ({
        ingredientId: row.ingredientId,
        sku: row.sku,
        name: row.name,
        baseUnitCode: row.baseUnitCode,
        currentStock: row.currentStock,
        reorderLevel: row.reorderLevel,
      }));

    const today = startOfDate(new Date().toISOString().slice(0, 10));
    const until = addDays(today, query.expiryDays);
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        active: true,
        expiresOn: { gte: today, lte: until },
        storageLocation: { locationId: query.locationId, active: true },
      },
      include: {
        ingredient: { select: { id: true, name: true } },
        storageLocation: { select: { id: true, code: true } },
      },
      orderBy: [{ expiresOn: 'asc' }, { id: 'asc' }],
    });
    const lotStocks = await this.lotStockById(
      this.prisma,
      lots.map((lot) => lot.id),
    );
    const expiringLots: ExpiringLotAlertDto[] = lots
      .map((lot) => ({
        inventoryLotId: lot.id,
        ingredientId: lot.ingredient.id,
        ingredientName: lot.ingredient.name,
        lotCode: lot.lotCode,
        storageLocationId: lot.storageLocation.id,
        storageLocationCode: lot.storageLocation.code,
        remainingStock: (lotStocks.get(lot.id) ?? new Prisma.Decimal(0)).toString(),
        expiresOn: lot.expiresOn?.toISOString().slice(0, 10) ?? '',
      }))
      .filter((lot) => new Prisma.Decimal(lot.remainingStock).gt(0));

    return {
      locationId: query.locationId,
      generatedAt: new Date().toISOString(),
      lowStock,
      expiringLots,
    };
  }

  async listRecipes(query: RecipeListQueryDto): Promise<RecipePageDto> {
    await this.requireLocation(this.prisma, query.locationId);
    const where = this.recipeWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.recipe.count({ where }),
      this.prisma.recipe.findMany({
        where,
        include: recipeInclude,
        orderBy: [{ menuItemVariantId: 'asc' }, { versionNo: 'desc' }],
        skip,
        take: query.pageSize,
      }),
    ]);
    return {
      data: rows.map((row) => this.toRecipe(row)),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async getRecipe(id: string): Promise<RecipeResponseDto> {
    const row = await this.prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
    if (!row) throw new NotFoundException('Receta no encontrada.');
    return this.toRecipe(row);
  }

  async createRecipe(
    dto: CreateRecipeDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<RecipeResponseDto> {
    validateRecipeLines(dto);
    const row = await this.prisma.$transaction(async (tx) => {
      await this.requireLocation(tx, dto.locationId);
      const variant = await tx.menuItemVariant.findUnique({
        where: { id: dto.menuItemVariantId },
        select: {
          id: true,
          active: true,
          menuItem: { select: { active: true, category: { select: { locationId: true } } } },
        },
      });
      if (
        !variant ||
        !variant.active ||
        !variant.menuItem.active ||
        variant.menuItem.category.locationId !== dto.locationId
      ) {
        throw new NotFoundException('Variante de menú no encontrada para la sede.');
      }
      const versionExists = await tx.recipe.findFirst({
        where: { menuItemVariantId: dto.menuItemVariantId, versionNo: dto.versionNo },
        select: { id: true },
      });
      if (versionExists) throw new ConflictException('La versión de receta ya existe.');
      const effectiveFrom = startOfDate(dto.effectiveFrom);
      const effectiveTo = dto.effectiveTo ? startOfDate(dto.effectiveTo) : null;
      validateRecipeDates(effectiveFrom, effectiveTo);
      await this.assertRecipeIntervalAvailable(
        tx,
        dto.menuItemVariantId,
        effectiveFrom,
        effectiveTo,
      );
      await this.requireActiveUnit(tx, dto.yieldUnitId);
      await this.validateRecipeLines(tx, dto.lines);
      const recipe = await tx.recipe.create({
        data: {
          menuItemVariantId: dto.menuItemVariantId,
          versionNo: dto.versionNo,
          effectiveFrom,
          effectiveTo,
          yieldQuantity: positiveDecimal(dto.yieldQuantity, 'El rendimiento'),
          yieldUnitId: dto.yieldUnitId,
          notes: dto.notes || null,
          lines: {
            create: dto.lines.map((line) => ({
              ingredientId: line.ingredientId,
              unitId: line.unitId,
              quantity: positiveDecimal(line.quantity, 'La cantidad de receta'),
              notes: line.notes || null,
            })),
          },
        },
        select: { id: true },
      });
      const created = await tx.recipe.findUnique({
        where: { id: recipe.id },
        include: recipeInclude,
      });
      if (!created) throw new NotFoundException('No se pudo recuperar la receta creada.');
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'recipe.created',
        entityType: 'recipe',
        entityId: recipe.id,
        afterData: {
          menuItemVariantId: dto.menuItemVariantId,
          versionNo: dto.versionNo,
          lineCount: dto.lines.length,
        },
      });
      return created;
    });
    return this.toRecipe(row);
  }

  async updateRecipe(
    id: string,
    dto: UpdateRecipeDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<RecipeResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.recipe.findUnique({ where: { id }, include: recipeInclude });
      if (!current) throw new NotFoundException('Receta no encontrada.');
      if (dto.active === true && !current.active) {
        await this.assertRecipeIntervalAvailable(
          tx,
          current.menuItemVariantId,
          current.effectiveFrom,
          current.effectiveTo,
          id,
        );
      }
      const updated = await tx.recipe.update({
        where: { id },
        data: {
          ...(dto.notes === undefined ? {} : { notes: dto.notes || null }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
        },
        include: recipeInclude,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'recipe.updated',
        entityType: 'recipe',
        entityId: id,
        beforeData: this.recipeAuditData(current),
        afterData: this.recipeAuditData(updated),
      });
      return updated;
    });
    return this.toRecipe(row);
  }

  private supplierWhere(query: SupplierListQueryDto): Prisma.SupplierWhereInput {
    return {
      locationId: query.locationId,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { supplierCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { taxId: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private ingredientWhere(query: IngredientListQueryDto): Prisma.IngredientWhereInput {
    return {
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { category: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private recipeWhere(query: RecipeListQueryDto): Prisma.RecipeWhereInput {
    return {
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.menuItemVariantId ? { menuItemVariantId: query.menuItemVariantId } : {}),
      menuItemVariant: {
        menuItem: {
          category: { locationId: query.locationId },
          ...(query.search
            ? {
                OR: [
                  { sku: { contains: query.search, mode: 'insensitive' } },
                  { nameEs: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
    };
  }

  private async assertSupplierCodeAvailable(
    client: DbClient,
    locationId: string,
    supplierCode: string,
    ignoredId?: string,
  ): Promise<void> {
    const duplicate = await client.supplier.findFirst({
      where: { locationId, supplierCode, ...(ignoredId ? { id: { not: ignoredId } } : {}) },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('El código de proveedor ya existe en la sede.');
  }

  private async assertIngredientIdentityAvailable(
    client: DbClient,
    sku: string,
    name: string,
    ignoredId?: string,
  ): Promise<void> {
    const duplicate = await client.ingredient.findFirst({
      where: {
        OR: [{ sku }, { name }],
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('El SKU o nombre del ingrediente ya existe.');
  }

  private async requireLocation(client: DbClient, id: string): Promise<void> {
    const location = await client.location.findFirst({
      where: { id, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private async requireSupplierForLocation(
    client: DbClient,
    supplierId: string,
    locationId: string,
  ): Promise<void> {
    const supplier = await client.supplier.findFirst({
      where: { id: supplierId, locationId, active: true },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado para la sede.');
  }

  private async requireCategoryAndUnit(
    client: DbClient,
    categoryId: string,
    unitId: string,
  ): Promise<void> {
    const [category, unit] = await Promise.all([
      client.ingredientCategory.findFirst({
        where: { id: categoryId, active: true },
        select: { id: true },
      }),
      client.unit.findFirst({ where: { id: unitId, active: true }, select: { id: true } }),
    ]);
    if (!category)
      throw new NotFoundException('Categoría de ingrediente no encontrada o inactiva.');
    if (!unit) throw new NotFoundException('Unidad de ingrediente no encontrada o inactiva.');
  }

  private async requireActiveUnit(client: DbClient, unitId: string): Promise<void> {
    const unit = await client.unit.findFirst({
      where: { id: unitId, active: true },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Unidad no encontrada o inactiva.');
  }

  private async requireStorageLocation(
    client: DbClient,
    storageLocationId: string,
    locationId: string,
  ): Promise<{ id: string }> {
    const storage = await client.storageLocation.findFirst({
      where: { id: storageLocationId, locationId, active: true },
      select: { id: true },
    });
    if (!storage) throw new NotFoundException('Bodega no encontrada para la sede.');
    return storage;
  }

  private async lockStorageLocation(
    client: Prisma.TransactionClient,
    storageLocationId: string,
    locationId: string,
  ): Promise<void> {
    // Serializa entradas y salidas por bodega sin agregar una columna de saldo mutable.
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${storageLocationId}))`;
    await this.requireStorageLocation(client, storageLocationId, locationId);
  }

  private async replaceSupplierLinks(
    client: Prisma.TransactionClient,
    ingredientId: string,
    links: IngredientSupplierInputDto[],
  ): Promise<void> {
    const supplierIds = links.map((link) => link.supplierId);
    if (new Set(supplierIds).size !== supplierIds.length) {
      throw new BadRequestException('No puede repetir un proveedor en el ingrediente.');
    }
    if (links.filter((link) => link.isPreferred).length > 1) {
      throw new BadRequestException('Solo puede existir un proveedor preferido por ingrediente.');
    }
    const [suppliers, units] = await Promise.all([
      client.supplier.findMany({
        where: { id: { in: supplierIds }, active: true },
        select: { id: true },
      }),
      client.unit.findMany({
        where: { id: { in: links.map((link) => link.packUnitId) }, active: true },
        select: { id: true },
      }),
    ]);
    if (suppliers.length !== new Set(supplierIds).size) {
      throw new NotFoundException('Uno de los proveedores no existe o está inactivo.');
    }
    if (units.length !== new Set(links.map((link) => link.packUnitId)).size) {
      throw new NotFoundException('Una unidad de presentación no existe o está inactiva.');
    }
    await client.ingredientSupplier.deleteMany({ where: { ingredientId } });
    if (links.length > 0) {
      await client.ingredientSupplier.createMany({
        data: links.map((link) => ({
          ingredientId,
          supplierId: link.supplierId,
          supplierSku: link.supplierSku || null,
          packQuantity: positiveDecimal(link.packQuantity, 'La cantidad de presentación'),
          packUnitId: link.packUnitId,
          unitCost: nonNegativeDecimal(link.unitCost, 'El costo de presentación'),
          isPreferred: link.isPreferred,
        })),
      });
    }
  }

  private async stockByIngredient(
    client: DbClient,
    locationId: string,
    ingredientIds: string[],
    storageLocationId?: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    if (ingredientIds.length === 0) return new Map();
    const groups = await client.inventoryMovement.groupBy({
      by: ['ingredientId'],
      where: {
        ingredientId: { in: ingredientIds },
        storageLocation: {
          locationId,
          ...(storageLocationId ? { id: storageLocationId } : {}),
        },
      },
      _sum: { quantityDelta: true },
    });
    return new Map(
      groups.map((group) => [
        group.ingredientId,
        group._sum.quantityDelta ?? new Prisma.Decimal(0),
      ]),
    );
  }

  private async stockForIngredient(
    client: DbClient,
    storageLocationId: string,
    ingredientId: string,
  ): Promise<Prisma.Decimal> {
    const result = await client.inventoryMovement.aggregate({
      where: { storageLocationId, ingredientId },
      _sum: { quantityDelta: true },
    });
    return result._sum.quantityDelta ?? new Prisma.Decimal(0);
  }

  private async lotStockById(
    client: DbClient,
    lotIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (lotIds.length === 0) return new Map();
    const groups = await client.inventoryMovement.groupBy({
      by: ['inventoryLotId'],
      where: { inventoryLotId: { in: lotIds } },
      _sum: { quantityDelta: true },
    });
    return new Map(
      groups
        .filter(
          (group): group is typeof group & { inventoryLotId: string } =>
            group.inventoryLotId !== null,
        )
        .map((group) => [group.inventoryLotId, group._sum.quantityDelta ?? new Prisma.Decimal(0)]),
    );
  }

  private async findReceiptDetail(client: DbClient, id: string): Promise<ReceiptDetailRow | null> {
    return client.goodsReceipt.findUnique({ where: { id }, include: receiptDetailInclude });
  }

  private async findMovement(client: DbClient, id: string): Promise<MovementRow | null> {
    return client.inventoryMovement.findUnique({ where: { id }, include: movementInclude });
  }

  private async validateRecipeLines(
    client: Prisma.TransactionClient,
    lines: CreateRecipeDto['lines'],
  ): Promise<void> {
    const ingredientIds = lines.map((line) => line.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException('Una receta no puede repetir el mismo ingrediente.');
    }
    const ingredients = await client.ingredient.findMany({
      where: { id: { in: ingredientIds }, active: true },
      select: { id: true, baseUnitId: true },
    });
    const units = await client.unit.findMany({
      where: { id: { in: lines.map((line) => line.unitId) }, active: true },
      select: { id: true },
    });
    const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const unitIds = new Set(units.map((unit) => unit.id));
    for (const line of lines) {
      const ingredient = ingredientById.get(line.ingredientId);
      if (!ingredient)
        throw new NotFoundException('Un ingrediente de la receta no existe o está inactivo.');
      if (!unitIds.has(line.unitId))
        throw new NotFoundException('Una unidad de receta no existe o está inactiva.');
      if (ingredient.baseUnitId !== line.unitId) {
        throw new BadRequestException(
          'Cada línea de receta debe usar la unidad base del ingrediente.',
        );
      }
    }
  }

  private async assertRecipeIntervalAvailable(
    client: Prisma.TransactionClient,
    menuItemVariantId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    ignoredId?: string,
  ): Promise<void> {
    const overlap = await client.recipe.findFirst({
      where: {
        menuItemVariantId,
        active: true,
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
        effectiveFrom: { lt: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      select: { id: true },
    });
    if (overlap)
      throw new ConflictException('La vigencia de la receta se traslapa con otra activa.');
  }

  private toSupplier(row: SupplierRow): SupplierResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      supplierCode: row.supplierCode,
      name: row.name,
      taxId: row.taxId,
      phone: row.phone,
      email: row.email,
      addressLine: row.addressLine,
      active: row.active,
      ingredientCount: row._count.ingredientLinks,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toIngredient(row: IngredientRow, stock: Prisma.Decimal): IngredientResponseDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      baseUnitId: row.baseUnitId,
      baseUnitCode: row.baseUnit.code,
      baseUnitName: row.baseUnit.name,
      sku: row.sku,
      name: row.name,
      description: row.description,
      reorderLevel: row.reorderLevel.toString(),
      currentStock: stock.toString(),
      lowStock: stock.lte(row.reorderLevel),
      trackLots: row.trackLots,
      active: row.active,
      supplierLinks: row.supplierLinks.map((link) => ({
        supplierId: link.supplierId,
        supplierName: link.supplier.name,
        supplierSku: link.supplierSku,
        packQuantity: link.packQuantity.toString(),
        packUnitId: link.packUnitId,
        packUnitCode: link.packUnit.code,
        unitCost: link.unitCost.toString(),
        isPreferred: link.isPreferred,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toReceiptListItem(row: ReceiptListRow): GoodsReceiptListItemDto {
    return {
      id: row.id,
      locationId: row.locationId,
      supplierId: row.supplierId,
      supplierName: row.supplier.name,
      receiptNumber: row.receiptNumber,
      receivedAt: row.receivedAt.toISOString(),
      notes: row.notes,
      lineCount: row.lines.length,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toReceipt(row: ReceiptDetailRow): GoodsReceiptResponseDto {
    return {
      ...this.toReceiptListItem({ ...row, lines: row.lines.map((line) => ({ id: line.id })) }),
      storageLocationId: row.lines[0]?.inventoryLot.storageLocationId ?? '',
      lines: row.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        inventoryLotId: line.inventoryLotId,
        lotCode: line.inventoryLot.lotCode,
        unitId: line.unitId,
        unitCode: line.unit.code,
        quantityReceived: line.quantityReceived.toString(),
        unitCost: line.unitCost.toString(),
        totalCost: line.totalCost.toString(),
        receivedOn: line.inventoryLot.receivedOn.toISOString().slice(0, 10),
        expiresOn: line.inventoryLot.expiresOn?.toISOString().slice(0, 10) ?? null,
      })),
    };
  }

  private toMovement(row: MovementRow): InventoryMovementResponseDto {
    return {
      id: row.id,
      storageLocationId: row.storageLocationId,
      storageLocationCode: row.storageLocation.code,
      ingredientId: row.ingredientId,
      ingredientName: row.ingredient.name,
      inventoryLotId: row.inventoryLotId,
      lotCode: row.inventoryLot?.lotCode ?? null,
      movementType: row.movementType,
      quantityDelta: row.quantityDelta.toString(),
      unitCost: row.unitCost.toString(),
      goodsReceiptLineId: row.goodsReceiptLineId,
      orderLineId: row.orderLineId,
      reason: row.reason,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toRecipe(row: RecipeRow): RecipeResponseDto {
    return {
      id: row.id,
      menuItemVariantId: row.menuItemVariantId,
      menuItemSku: row.menuItemVariant.menuItem.sku,
      menuItemName: row.menuItemVariant.menuItem.nameEs,
      variantName: row.menuItemVariant.nameEs,
      versionNo: row.versionNo,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
      yieldQuantity: row.yieldQuantity.toString(),
      yieldUnitId: row.yieldUnitId,
      yieldUnitCode: row.yieldUnit.code,
      notes: row.notes,
      active: row.active,
      lines: row.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        ingredientSku: line.ingredient.sku,
        unitId: line.unitId,
        unitCode: line.unit.code,
        quantity: line.quantity.toString(),
        notes: line.notes,
      })),
    };
  }

  private supplierAuditData(row: SupplierRow): AuditData {
    return {
      locationId: row.locationId,
      supplierCode: row.supplierCode,
      name: row.name,
      active: row.active,
    };
  }

  private ingredientAuditData(row: IngredientRow): AuditData {
    return {
      categoryId: row.categoryId,
      baseUnitId: row.baseUnitId,
      sku: row.sku,
      name: row.name,
      reorderLevel: row.reorderLevel.toString(),
      active: row.active,
    };
  }

  private recipeAuditData(row: RecipeRow): AuditData {
    return {
      menuItemVariantId: row.menuItemVariantId,
      versionNo: row.versionNo,
      active: row.active,
      lineCount: row.lines.length,
    };
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    metadata: RequestMetadata,
    event: {
      action: string;
      entityType: string;
      entityId?: string;
      beforeData?: AuditData;
      afterData?: AuditData;
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

  private pageMeta(page: number, pageSize: number, total: number): InventoryPageMetaDto {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}

function nonNegativeDecimal(value: string, label: string): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${label} no es válido.`);
  }
  if (!decimal.isFinite() || decimal.isNegative()) {
    throw new BadRequestException(`${label} no puede ser negativo.`);
  }
  return decimal;
}

function positiveDecimal(value: string, label: string): Prisma.Decimal {
  const decimal = nonNegativeDecimal(value, label);
  if (decimal.isZero()) throw new BadRequestException(`${label} debe ser mayor que cero.`);
  return decimal;
}

function startOfDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function startOfNextDate(value: string): Date {
  return addDays(startOfDate(value), 1);
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function validateReceiptLines(dto: CreateGoodsReceiptDto): void {
  const keys = dto.lines.map((line) => `${line.ingredientId}:${line.lotCode}`);
  if (new Set(keys).size !== keys.length) {
    throw new BadRequestException(
      'No puede repetir el mismo lote para un ingrediente en la recepción.',
    );
  }
}

function validateRecipeLines(dto: CreateRecipeDto): void {
  if (new Set(dto.lines.map((line) => line.ingredientId)).size !== dto.lines.length) {
    throw new BadRequestException('Una receta no puede repetir el mismo ingrediente.');
  }
  const effectiveFrom = startOfDate(dto.effectiveFrom);
  const effectiveTo = dto.effectiveTo ? startOfDate(dto.effectiveTo) : null;
  validateRecipeDates(effectiveFrom, effectiveTo);
}

function validateRecipeDates(effectiveFrom: Date, effectiveTo: Date | null): void {
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new BadRequestException('La vigencia final debe ser posterior a la inicial.');
  }
}
