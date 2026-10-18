import { describe, expect, it, vi, beforeEach } from 'vitest';

import { PurchaseOrderStatus } from '../generated/prisma/enums.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(() => {
    prisma = {
      purchaseOrder: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      purchaseOrderLine: {
        update: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      supplier: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      location: {
        findUnique: vi.fn(),
      },
      storageLocation: {
        findUnique: vi.fn(),
      },
      inventoryLot: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    eventEmitter = {
      emit: vi.fn(),
    };
    service = new PurchaseOrdersService(prisma, eventEmitter);
  });

  describe('createOrder', () => {
    it('crea una orden en estado Draft con número generado', async () => {
      const locationId = 'loc-1';
      const supplierId = 'sup-1';
      const actorUserId = 'user-1';

      prisma.location.findUnique.mockResolvedValue({ id: locationId });
      prisma.supplier.findUnique.mockResolvedValue({ id: supplierId, name: 'Proveedor Test' });
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);
      prisma.purchaseOrder.create.mockResolvedValue({
        id: 'po-1',
        orderNumber: 'PO-202610-0001',
        locationId,
        supplierId,
        status: PurchaseOrderStatus.Draft,
        orderDate: new Date('2026-10-17'),
        expectedDelivery: null,
        totalAmount: '1500.00',
        notes: null,
        createdByUserId: actorUserId,
        approvedByUserId: null,
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { name: 'Proveedor Test' },
        lines: [
          {
            id: 'line-1',
            ingredientId: 'ing-1',
            unitId: 'unit-1',
            quantityOrdered: '10',
            unitCost: '150',
            totalCost: '1500',
            quantityReceived: null,
            receivedAt: null,
            ingredient: { name: 'Café' },
            unit: { code: 'kg' },
          },
        ],
      });

      const result = await service.createOrder(
        {
          locationId,
          supplierId,
          orderDate: '2026-10-17',
          lines: [{ ingredientId: 'ing-1', unitId: 'unit-1', quantityOrdered: 10, unitCost: 150 }],
        },
        actorUserId,
        { ipAddress: '127.0.0.1', requestId: 'req-1' },
      );

      expect(result.status).toBe(PurchaseOrderStatus.Draft);
      expect(result.orderNumber).toMatch(/^PO-\d{6}-\d{4}$/);
      expect(prisma.purchaseOrder.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'purchase-order.created',
        expect.objectContaining({ purchaseOrderId: 'po-1' }),
      );
    });
  });

  describe('approveOrder', () => {
    it('aprueba una orden en estado Submitted', async () => {
      const orderId = 'po-1';
      const actorUserId = 'user-1';

      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: orderId,
        status: PurchaseOrderStatus.Submitted,
      });

      prisma.purchaseOrder.update.mockResolvedValue({
        id: orderId,
        orderNumber: 'PO-202610-0001',
        status: PurchaseOrderStatus.Approved,
        orderDate: new Date('2026-10-17'),
        expectedDelivery: null,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
        totalAmount: '1500.00',
        notes: null,
        locationId: 'loc-1',
        supplierId: 'sup-1',
        createdByUserId: 'user-0',
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { name: 'Proveedor Test' },
        lines: [],
      });

      const result = await service.approveOrder(orderId, actorUserId, {
        ipAddress: '127.0.0.1',
        requestId: 'req-1',
      });

      expect(result.status).toBe(PurchaseOrderStatus.Approved);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'purchase-order.approved',
        expect.objectContaining({ purchaseOrderId: orderId }),
      );
    });

    it('rechaza aprobar una orden que no está en Submitted', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.Draft,
      });

      await expect(
        service.approveOrder('po-1', 'user-1', {
          ipAddress: '127.0.0.1',
          requestId: 'req-1',
        }),
      ).rejects.toThrow('Solo se pueden aprobar órdenes en estado Submitted');
    });
  });

  describe('receiveOrder', () => {
    it('recibe una orden aprobada y genera movimientos de inventario', async () => {
      const orderId = 'po-1';
      const actorUserId = 'user-1';

      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: orderId,
        orderNumber: 'PO-202610-0001',
        status: PurchaseOrderStatus.Approved,
        supplierId: 'sup-1',
        orderDate: new Date('2026-10-17'),
        supplier: { name: 'Proveedor Test' },
        lines: [
          {
            id: 'line-1',
            ingredientId: 'ing-1',
            unitId: 'unit-1',
            quantityOrdered: '10',
            unitCost: '150',
            ingredient: { name: 'Café', baseUnitId: 'unit-1' },
            unit: { code: 'kg' },
          },
        ],
      });

      prisma.storageLocation.findUnique.mockResolvedValue({ id: 'storage-1' });
      prisma.inventoryLot.findFirst.mockResolvedValue(null);
      prisma.inventoryLot.create.mockResolvedValue({ id: 'lot-1' });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: orderId,
        orderNumber: 'PO-202610-0001',
        status: PurchaseOrderStatus.Received,
        orderDate: new Date('2026-10-17'),
        expectedDelivery: null,
        totalAmount: '1500.00',
        notes: null,
        locationId: 'loc-1',
        supplierId: 'sup-1',
        createdByUserId: 'user-0',
        approvedByUserId: null,
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { name: 'Proveedor Test' },
        lines: [],
      });

      await service.receiveOrder(
        orderId,
        {
          storageLocationId: 'storage-1',
          lines: [{ lineId: 'line-1', quantityReceived: 10, lotCode: 'LOT-001' }],
        },
        actorUserId,
        { ipAddress: '127.0.0.1', requestId: 'req-1' },
      );

      expect(prisma.inventoryLot.create).toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).toHaveBeenCalled();
      expect(prisma.purchaseOrderLine.update).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'purchase-order.received',
        expect.objectContaining({ purchaseOrderId: orderId }),
      );
    });
  });

  describe('replaceDraftLines', () => {
    it('agrega, modifica y quita líneas de una orden Draft y recalcula el total', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.Draft,
        lines: [{ id: 'line-1' }, { id: 'line-obsolete' }],
      });
      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        orderNumber: 'PO-202610-0001',
        status: PurchaseOrderStatus.Draft,
        orderDate: new Date('2026-10-17'),
        expectedDelivery: null,
        totalAmount: '800.00',
        notes: null,
        locationId: 'loc-1',
        supplierId: 'sup-1',
        createdByUserId: 'user-0',
        approvedByUserId: null,
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { name: 'Proveedor Test' },
        lines: [
          {
            id: 'line-1',
            ingredientId: 'ing-1',
            unitId: 'unit-1',
            quantityOrdered: '2',
            unitCost: '100',
            totalCost: '200',
            quantityReceived: null,
            receivedAt: null,
            ingredient: { name: 'Café' },
            unit: { code: 'kg' },
          },
          {
            id: 'line-2',
            ingredientId: 'ing-2',
            unitId: 'unit-1',
            quantityOrdered: '3',
            unitCost: '200',
            totalCost: '600',
            quantityReceived: null,
            receivedAt: null,
            ingredient: { name: 'Azúcar' },
            unit: { code: 'kg' },
          },
        ],
      });

      const result = await service.replaceDraftLines(
        'po-1',
        [
          {
            id: 'line-1',
            ingredientId: 'ing-1',
            unitId: 'unit-1',
            quantityOrdered: 2,
            unitCost: 100,
          },
          { ingredientId: 'ing-2', unitId: 'unit-1', quantityOrdered: 3, unitCost: 200 },
        ],
        'user-1',
        { ipAddress: '127.0.0.1', requestId: 'req-1' },
      );

      expect(prisma.purchaseOrderLine.deleteMany).toHaveBeenCalledWith({
        where: { purchaseOrderId: 'po-1', id: { in: ['line-obsolete'] } },
      });
      expect(prisma.purchaseOrderLine.update).toHaveBeenCalled();
      expect(prisma.purchaseOrderLine.create).toHaveBeenCalled();
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalAmount: expect.anything() }),
        }),
      );
      expect(result.totalAmount).toBe('800.00');
    });

    it('rechaza editar líneas si la orden no está en Draft', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.Submitted,
        lines: [{ id: 'line-1' }],
      });

      await expect(
        service.replaceDraftLines(
          'po-1',
          [{ ingredientId: 'ing-1', unitId: 'unit-1', quantityOrdered: 1, unitCost: 10 }],
          'user-1',
          { ipAddress: '127.0.0.1', requestId: 'req-1' },
        ),
      ).rejects.toThrow('Las líneas solo se pueden editar en estado Draft');
    });
  });

  describe('createSupplier', () => {
    it('crea un proveedor con código único', async () => {
      const locationId = 'loc-1';
      const actorUserId = 'user-1';

      prisma.location.findUnique.mockResolvedValue({ id: locationId });
      prisma.supplier.findFirst.mockResolvedValue(null);
      prisma.supplier.create.mockResolvedValue({
        id: 'sup-1',
        locationId,
        supplierCode: 'SUP-001',
        name: 'Proveedor Nuevo',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createSupplier(
        {
          locationId,
          supplierCode: 'SUP-001',
          name: 'Proveedor Nuevo',
        },
        actorUserId,
        { ipAddress: '127.0.0.1', requestId: 'req-1' },
      );

      expect(result.supplierCode).toBe('SUP-001');
      expect(prisma.supplier.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('rechaza crear proveedor con código duplicado', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-1' });
      prisma.supplier.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createSupplier(
          { locationId: 'loc-1', supplierCode: 'SUP-001', name: 'Test' },
          'user-1',
          { ipAddress: '127.0.0.1', requestId: 'req-1' },
        ),
      ).rejects.toThrow('Ya existe un proveedor con ese código');
    });
  });
});
