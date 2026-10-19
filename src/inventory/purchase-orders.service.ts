import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { RequestMetadata } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PurchaseOrderStatus, InventoryMovementType } from '../generated/prisma/enums.js';
import type {
  PurchaseOrderCreatedEvent,
  PurchaseOrderApprovedEvent,
  PurchaseOrderReceivedEvent,
} from '../domain-events/events/index.js';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderLineDto,
  PurchaseOrderListQueryDto,
  ReceivePurchaseOrderDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierListQueryDto,
} from './dto/purchase-order.dto.js';
import {
  PurchaseOrderResponseDto,
  PurchaseOrderPageDto,
  PurchaseOrderLineResponseDto,
  SupplierResponseDto,
  SupplierPageDto,
  SupplierOrderHistoryDto,
} from './dto/purchase-order-response.dto.js';

type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{
  include: {
    supplier: { select: { name: true } };
    lines: {
      include: {
        ingredient: { select: { name: true } };
        unit: { select: { code: true } };
      };
    };
  };
}>;

type SupplierRecord = Prisma.SupplierGetPayload<object>;

/** Gestiona órdenes de compra, transiciones de estado, recepción y proveedores. */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

/**
 * Pagina órdenes de compra de una sede con filtros opcionales de estado y proveedor.
 */
  async listOrders(query: PurchaseOrderListQueryDto): Promise<PurchaseOrderPageDto> {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);
    const skip = (page - 1) * perPage;

    const where: Prisma.PurchaseOrderWhereInput = {
      locationId: query.locationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          lines: {
            include: {
              ingredient: { select: { name: true } },
              unit: { select: { code: true } },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: orders.map(toPurchaseOrderResponse),
      total,
      page,
      perPage,
    };
  }

/**
 * Devuelve una orden con proveedor y líneas o responde no encontrada.
 */
  async getOrder(id: string): Promise<PurchaseOrderResponseDto> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            ingredient: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    return toPurchaseOrderResponse(order);
  }

/**
 * Crea orden en borrador, calcula total, audita y emite evento de dominio.
 */
  async createOrder(
    dto: CreatePurchaseOrderDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    await this.ensureLocationExists(dto.locationId);
    const supplier = await this.ensureSupplierExists(dto.supplierId);

    const orderNumber = await this.generateOrderNumber(dto.locationId);

    const totalAmount = dto.lines.reduce(
      (sum, line) => sum.add(new Prisma.Decimal(line.quantityOrdered).mul(line.unitCost)),
      new Prisma.Decimal(0),
    );

    const order = await this.prisma.purchaseOrder.create({
      data: {
        locationId: dto.locationId,
        supplierId: dto.supplierId,
        orderNumber,
        orderDate: new Date(dto.orderDate),
        expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : null,
        status: PurchaseOrderStatus.Draft,
        totalAmount,
        notes: dto.notes,
        createdByUserId: actorUserId,
        lines: {
          create: dto.lines.map((line) => ({
            ingredientId: line.ingredientId,
            unitId: line.unitId,
            quantityOrdered: new Prisma.Decimal(line.quantityOrdered),
            unitCost: new Prisma.Decimal(line.unitCost),
            totalCost: new Prisma.Decimal(line.quantityOrdered).mul(line.unitCost),
          })),
        },
      },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            ingredient: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'purchase_order.created',
        entityType: 'purchase_order',
        entityId: order.id,
        afterData: { orderNumber, supplierId: dto.supplierId, totalAmount: totalAmount.toString() },
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      },
    });

    const event: PurchaseOrderCreatedEvent = {
      purchaseOrderId: order.id,
      locationId: order.locationId,
      supplierId: order.supplierId,
      supplierName: supplier.name,
      orderNumber: order.orderNumber,
      totalAmount: totalAmount.toString(),
    };
    this.eventEmitter.emit('purchase-order.created', event);

    return toPurchaseOrderResponse(order);
  }

/**
 * Actualiza notas, entrega esperada o líneas según reglas de estado Draft/Submitted.
 */
  async updateOrder(
    id: string,
    dto: UpdatePurchaseOrderDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (dto.lines) {
      if (existing.status !== PurchaseOrderStatus.Draft) {
        throw new ConflictException('Las líneas solo se pueden editar en estado Draft');
      }
    } else if (
      existing.status !== PurchaseOrderStatus.Draft &&
      existing.status !== PurchaseOrderStatus.Submitted
    ) {
      throw new ConflictException('Solo se pueden modificar órdenes en estado Draft o Submitted');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await this.replaceDraftLinesInTx(tx, id, existing.lines, dto.lines);
      }

      const totalAmount = dto.lines ? this.calculateLinesTotal(dto.lines) : undefined;

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : undefined,
          notes: dto.notes,
          ...(totalAmount ? { totalAmount } : {}),
        },
        include: {
          supplier: { select: { name: true } },
          lines: {
            include: {
              ingredient: { select: { name: true } },
              unit: { select: { code: true } },
            },
          },
        },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'purchase_order.updated',
        entityType: 'purchase_order',
        entityId: id,
        afterData: {
          expectedDelivery: dto.expectedDelivery ?? null,
          notes: dto.notes ?? null,
          linesChanged: Boolean(dto.lines),
          totalAmount: updated.totalAmount.toString(),
        },
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      },
    });

    return toPurchaseOrderResponse(updated);
  }

/**
 * Atajo para reemplazar líneas en borrador reutilizando updateOrder.
 */
  async replaceDraftLines(
    id: string,
    lines: UpdatePurchaseOrderLineDto[],
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    return this.updateOrder(id, { lines }, actorUserId, metadata);
  }

/**
 * Pasa la orden de Draft a Submitted con auditoría.
 */
  async submitOrder(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    return this.transitionStatus(
      id,
      PurchaseOrderStatus.Submitted,
      actorUserId,
      metadata,
      'purchase_order.submitted',
    );
  }

/**
 * Aprueba una orden Submitted, registra aprobador y emite evento.
 */
  async approveOrder(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (order.status !== PurchaseOrderStatus.Submitted) {
      throw new ConflictException('Solo se pueden aprobar órdenes en estado Submitted');
    }

    const approved = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.Approved,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            ingredient: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'purchase_order.approved',
        entityType: 'purchase_order',
        entityId: id,
        afterData: { status: PurchaseOrderStatus.Approved },
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      },
    });

    const event: PurchaseOrderApprovedEvent = {
      purchaseOrderId: approved.id,
      orderNumber: approved.orderNumber,
      approvedByUserId: actorUserId,
      totalAmount: approved.totalAmount.toString(),
    };
    this.eventEmitter.emit('purchase-order.approved', event);

    return toPurchaseOrderResponse(approved);
  }

/**
 * Cancela una orden que aún no fue recibida por completo.
 */
  async cancelOrder(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (order.status === PurchaseOrderStatus.Received) {
      throw new ConflictException('No se puede cancelar una orden ya recibida');
    }

    return this.transitionStatus(
      id,
      PurchaseOrderStatus.Cancelled,
      actorUserId,
      metadata,
      'purchase_order.cancelled',
    );
  }

/**
 * Recibe una orden Approved creando lotes, movimientos y actualizando proveedor.
 */
  async receiveOrder(
    id: string,
    dto: ReceivePurchaseOrderDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<PurchaseOrderResponseDto> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            ingredient: { select: { name: true, baseUnitId: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (order.status !== PurchaseOrderStatus.Approved) {
      throw new ConflictException('Solo se pueden recibir órdenes en estado Approved');
    }

    await this.ensureStorageLocationExists(dto.storageLocationId);

    let totalQuantityReceived = new Prisma.Decimal(0);

    const received = await this.prisma.$transaction(async (tx) => {
      const receivedAt = new Date();

      for (const item of dto.lines) {
        const line = order.lines.find((l) => l.id === item.lineId);
        if (!line) {
          throw new NotFoundException(`Línea de orden ${item.lineId} no encontrada`);
        }

        totalQuantityReceived = totalQuantityReceived.add(item.quantityReceived);

        let lot = await tx.inventoryLot.findFirst({
          where: {
            ingredientId: line.ingredientId,
            storageLocationId: dto.storageLocationId,
            lotCode: item.lotCode,
          },
        });

        if (!lot) {
          lot = await tx.inventoryLot.create({
            data: {
              ingredientId: line.ingredientId,
              storageLocationId: dto.storageLocationId,
              supplierId: order.supplierId,
              lotCode: item.lotCode,
              receivedOn: receivedAt,
              quantityReceived: new Prisma.Decimal(item.quantityReceived),
              unitCost: line.unitCost,
              expiresOn: item.expiresOn ? new Date(item.expiresOn) : null,
            },
          });
        }

        await tx.inventoryMovement.create({
          data: {
            ingredientId: line.ingredientId,
            storageLocationId: dto.storageLocationId,
            inventoryLotId: lot.id,
            movementType: InventoryMovementType.Receipt,
            quantityDelta: new Prisma.Decimal(item.quantityReceived),
            unitCost: line.unitCost,
            createdByUserId: actorUserId,
            reason: `Recepción de orden ${order.orderNumber}${dto.notes ? ` - ${dto.notes}` : ''}`,
          },
        });

        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            quantityReceived: new Prisma.Decimal(item.quantityReceived),
            receivedAt,
          },
        });
      }

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.Received },
        include: {
          supplier: { select: { name: true } },
          lines: {
            include: {
              ingredient: { select: { name: true } },
              unit: { select: { code: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'purchase_order.received',
          entityType: 'purchase_order',
          entityId: id,
          afterData: {
            storageLocationId: dto.storageLocationId,
            linesReceived: dto.lines.length,
            totalQuantityReceived: totalQuantityReceived.toString(),
          },
          ipAddress: metadata.ipAddress,
          requestId: metadata.requestId,
        },
      });

      await tx.supplier.update({
        where: { id: order.supplierId },
        data: { lastOrderDate: order.orderDate },
      });

      return updatedOrder;
    });

    const event: PurchaseOrderReceivedEvent = {
      purchaseOrderId: received.id,
      orderNumber: received.orderNumber,
      supplierId: received.supplierId,
      locationId: received.locationId,
      linesReceived: dto.lines.length,
      totalQuantityReceived: totalQuantityReceived.toString(),
    };
    this.eventEmitter.emit('purchase-order.received', event);

    return toPurchaseOrderResponse(received);
  }

/**
 * Resume hasta 50 órdenes recibidas de un proveedor con total acumulado.
 */
  async getSupplierOrderHistory(supplierId: string): Promise<SupplierOrderHistoryDto> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { supplierId, status: PurchaseOrderStatus.Received },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            ingredient: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
      take: 50,
    });

    const totalAmount = orders.reduce(
      (sum, order) => sum.add(order.totalAmount),
      new Prisma.Decimal(0),
    );

    return {
      orders: orders.map(toPurchaseOrderResponse),
      totalOrders: orders.length,
      totalAmount: totalAmount.toString(),
    };
  }

/**
 * Pagina proveedores de compras por sede.
 */
  async listSuppliers(query: SupplierListQueryDto): Promise<SupplierPageDto> {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);
    const skip = (page - 1) * perPage;

    const where: Prisma.SupplierWhereInput = {
      locationId: query.locationId,
    };

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers.map(toSupplierResponse),
      total,
      page,
      perPage,
    };
  }

/**
 * Obtiene un proveedor por id.
 */
  async getSupplier(id: string): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return toSupplierResponse(supplier);
  }

/**
 * Crea proveedor de compras con código único por sede y auditoría.
 */
  async createSupplier(
    dto: CreateSupplierDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<SupplierResponseDto> {
    await this.ensureLocationExists(dto.locationId);

    const exists = await this.prisma.supplier.findFirst({
      where: {
        locationId: dto.locationId,
        supplierCode: dto.supplierCode,
      },
    });

    if (exists) {
      throw new ConflictException('Ya existe un proveedor con ese código en esta sede');
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        locationId: dto.locationId,
        supplierCode: dto.supplierCode,
        name: dto.name,
        taxId: dto.taxId,
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        deliveryDays: dto.deliveryDays,
        orderReminderDays: dto.orderReminderDays,
        notes: dto.notes,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'supplier.created',
        entityType: 'supplier',
        entityId: supplier.id,
        afterData: { supplierCode: dto.supplierCode, name: dto.name },
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      },
    });

    return toSupplierResponse(supplier);
  }

/**
 * Actualiza datos operativos del proveedor de compras.
 */
  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<SupplierResponseDto> {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        taxId: dto.taxId,
        phone: dto.phone,
        email: dto.email,
        addressLine: dto.addressLine,
        deliveryDays: dto.deliveryDays,
        orderReminderDays: dto.orderReminderDays,
        notes: dto.notes,
        active: dto.active,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'supplier.updated',
        entityType: 'supplier',
        entityId: id,
        afterData: {
          name: dto.name ?? null,
          active: dto.active ?? null,
        } as any,
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      },
    });

    return toSupplierResponse(updated);
  }

/**
 * Aplica un cambio de estado genérico con registro en auditoría.
 */
  private async transitionStatus(
    id: string,
    status: PurchaseOrderStatus,
    actorUserId: string,
    metadata: RequestMetadata,
    action: string,
  ): Promise<PurchaseOrderResponseDto> {
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            ingredient: { select: { name: true } },
            unit: { select: { code: true } },
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType: 'purchase_order',
        entityId: id,
        afterData: { status },
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      },
    });

    return toPurchaseOrderResponse(updated);
  }

/**
 * Genera número secuencial PO-AAAAMM-#### por sede y mes.
 */
  private async generateOrderNumber(locationId: string): Promise<string> {
    const today = new Date();
    const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

    const lastOrder = await this.prisma.purchaseOrder.findFirst({
      where: {
        locationId,
        orderNumber: { startsWith: prefix },
      },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

/**
 * Verifica existencia de sede antes de operaciones de compra.
 */
  private async ensureLocationExists(locationId: string): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });

    if (!location) {
      throw new NotFoundException('Sede no encontrada');
    }
  }

/**
 * Verifica proveedor existente y devuelve nombre para eventos.
 */
  private async ensureSupplierExists(supplierId: string): Promise<{ name: string }> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

/**
 * Verifica que la bodega de recepción exista.
 */
  private async ensureStorageLocationExists(storageLocationId: string): Promise<void> {
    const storage = await this.prisma.storageLocation.findUnique({
      where: { id: storageLocationId },
      select: { id: true },
    });

    if (!storage) {
      throw new NotFoundException('Ubicación de almacenamiento no encontrada');
    }
  }

/**
 * Suma costo total de líneas de orden en actualización.
 */
  private calculateLinesTotal(lines: UpdatePurchaseOrderLineDto[]): Prisma.Decimal {
    return lines.reduce(
      (sum, line) => sum.add(new Prisma.Decimal(line.quantityOrdered).mul(line.unitCost)),
      new Prisma.Decimal(0),
    );
  }

/**
 * Sincroniza líneas de borrador: altas, bajas y recálculo por transacción.
 */
  private async replaceDraftLinesInTx(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
    currentLines: readonly { id: string }[],
    nextLines: UpdatePurchaseOrderLineDto[],
  ): Promise<void> {
    const currentIds = new Set(currentLines.map((line) => line.id));
    const keepIds = new Set<string>();

    for (const line of nextLines) {
      if (!line.id) continue;
      if (!currentIds.has(line.id)) {
        throw new NotFoundException(`Línea de orden ${line.id} no encontrada`);
      }
      keepIds.add(line.id);
    }

    const removeIds = currentLines.filter((line) => !keepIds.has(line.id)).map((line) => line.id);
    if (removeIds.length > 0) {
      await tx.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId, id: { in: removeIds } },
      });
    }

    for (const line of nextLines) {
      const quantityOrdered = new Prisma.Decimal(line.quantityOrdered);
      const unitCost = new Prisma.Decimal(line.unitCost);
      const totalCost = quantityOrdered.mul(unitCost);
      const data = {
        ingredientId: line.ingredientId,
        unitId: line.unitId,
        quantityOrdered,
        unitCost,
        totalCost,
      };

      if (line.id) {
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data,
        });
      } else {
        await tx.purchaseOrderLine.create({
          data: { purchaseOrderId, ...data },
        });
      }
    }
  }
}

/**
 * Mapea orden Prisma al DTO de respuesta de compras.
 */
function toPurchaseOrderResponse(order: PurchaseOrderRecord): PurchaseOrderResponseDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    locationId: order.locationId,
    supplierId: order.supplierId,
    supplierName: order.supplier.name,
    status: order.status,
    orderDate: order.orderDate.toISOString().slice(0, 10),
    expectedDelivery: order.expectedDelivery?.toISOString().slice(0, 10) ?? null,
    totalAmount: order.totalAmount.toString(),
    notes: order.notes,
    createdByUserId: order.createdByUserId,
    approvedByUserId: order.approvedByUserId,
    approvedAt: order.approvedAt?.toISOString() ?? null,
    lines: order.lines.map(toLineResponse),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

/**
 * Mapea línea de orden al DTO con cantidades recibidas opcionales.
 */
function toLineResponse(line: PurchaseOrderRecord['lines'][number]): PurchaseOrderLineResponseDto {
  return {
    id: line.id,
    ingredientId: line.ingredientId,
    ingredientName: line.ingredient.name,
    unitId: line.unitId,
    unitCode: line.unit.code,
    quantityOrdered: line.quantityOrdered.toString(),
    unitCost: line.unitCost.toString(),
    totalCost: line.totalCost.toString(),
    quantityReceived: line.quantityReceived?.toString() ?? null,
    receivedAt: line.receivedAt?.toISOString() ?? null,
  };
}

/**
 * Mapea proveedor al DTO del módulo de órdenes de compra.
 */
function toSupplierResponse(supplier: SupplierRecord): SupplierResponseDto {
  return {
    id: supplier.id,
    locationId: supplier.locationId,
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    taxId: supplier.taxId,
    phone: supplier.phone,
    email: supplier.email,
    addressLine: supplier.addressLine,
    deliveryDays: supplier.deliveryDays,
    orderReminderDays: supplier.orderReminderDays,
    lastOrderDate: supplier.lastOrderDate?.toISOString().slice(0, 10) ?? null,
    notes: supplier.notes,
    active: supplier.active,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}
