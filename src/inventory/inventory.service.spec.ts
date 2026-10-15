import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import { InventoryMovementType } from '../generated/prisma/enums.js';
import { InventoryService } from './inventory.service.js';

const locationId = '20000000-0000-0000-0000-000000000001';
const storageLocationId = '69000000-0000-0000-0000-000000000001';
const supplierId = '68000000-0000-0000-0000-000000000001';
const ingredientId = '67000000-0000-0000-0000-000000000001';
const receiptId = '6b000000-0000-0000-0000-000000000001';

function metadata() {
  return { ipAddress: '127.0.0.1', requestId: 'test-request' };
}

describe('InventoryService', () => {
  it('no lee un proveedor desde otra sede aunque se conozca su ID', async () => {
    const prisma = {
      supplier: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.getSupplier(supplierId, '20000000-0000-0000-0000-000000000002'),
    ).rejects.toThrow('Proveedor no encontrado.');
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: supplierId, locationId: expect.any(String) } }),
    );
  });

  it('no lee una recepción desde otra sede aunque se conozca su ID', async () => {
    const prisma = {
      goodsReceipt: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.getReceipt(receiptId, '20000000-0000-0000-0000-000000000002'),
    ).rejects.toThrow('Recepción no encontrada.');
    expect(prisma.goodsReceipt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: receiptId, locationId: expect.any(String) } }),
    );
  });

  it('no lee una receta desde otra sede aunque se conozca su ID', async () => {
    const prisma = {
      recipe: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.getRecipe('recipe-1', '20000000-0000-0000-0000-000000000002'),
    ).rejects.toThrow('Receta no encontrada.');
    expect(prisma.recipe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'recipe-1',
          menuItemVariant: { menuItem: { category: { locationId: expect.any(String) } } },
        },
      }),
    );
  });

  it('devuelve una recepción existente y no duplica sus movimientos', async () => {
    const detail = {
      id: receiptId,
      locationId,
      supplierId,
      receiptNumber: 'GR-TEST-001',
      receivedAt: new Date('2026-10-12T12:00:00.000Z'),
      receivedByUserId: '41000000-0000-0000-0000-000000000001',
      notes: null,
      createdAt: new Date('2026-10-12T12:00:00.000Z'),
      supplier: { name: 'Proveedor de prueba' },
      lines: [
        {
          id: '6c000000-0000-0000-0000-000000000001',
          ingredientId,
          inventoryLotId: '6a000000-0000-0000-0000-000000000001',
          unitId: '66000000-0000-0000-0000-000000000002',
          quantityReceived: new Prisma.Decimal('1000'),
          unitCost: new Prisma.Decimal('0.028'),
          totalCost: new Prisma.Decimal('28'),
          ingredient: { name: 'Café' },
          unit: { code: 'g' },
          inventoryLot: {
            id: '6a000000-0000-0000-0000-000000000001',
            lotCode: 'LOT-TEST',
            storageLocationId,
            receivedOn: new Date('2026-10-12T00:00:00.000Z'),
            expiresOn: null,
          },
        },
      ],
    };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      storageLocation: {
        findFirst: vi.fn().mockResolvedValue({ id: storageLocationId }),
      },
      goodsReceipt: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: receiptId, supplierId })
          .mockResolvedValueOnce(detail),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new InventoryService(prisma as never);

    const result = await service.createReceipt(
      {
        locationId,
        supplierId,
        receiptNumber: 'GR-TEST-001',
        receivedAt: '2026-10-12T12:00:00.000Z',
        storageLocationId,
        lines: [
          {
            ingredientId,
            unitId: '66000000-0000-0000-0000-000000000002',
            lotCode: 'LOT-TEST',
            receivedOn: '2026-10-12',
            quantityReceived: '1000',
            unitCost: '0.028',
          },
        ],
      },
      '41000000-0000-0000-0000-000000000001',
      metadata(),
    );

    expect(result.id).toBe(receiptId);
    expect(tx.goodsReceipt.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.storageLocation.findFirst).toHaveBeenCalledOnce();
  });

  it('rechaza una recepción repetida con payload diferente', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      storageLocation: { findFirst: vi.fn().mockResolvedValue({ id: storageLocationId }) },
      goodsReceipt: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: receiptId, supplierId })
          .mockResolvedValueOnce({
            id: receiptId,
            locationId,
            supplierId,
            receiptNumber: 'GR-TEST-001',
            receivedAt: new Date('2026-10-12T12:00:00.000Z'),
            notes: null,
            lines: [
              {
                ingredientId,
                unitId: '66000000-0000-0000-0000-000000000002',
                quantityReceived: new Prisma.Decimal('1000'),
                unitCost: new Prisma.Decimal('0.028'),
                inventoryLot: {
                  lotCode: 'LOT-TEST',
                  storageLocationId,
                  receivedOn: new Date('2026-10-12T00:00:00.000Z'),
                  expiresOn: null,
                },
              },
            ],
          }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.createReceipt(
        {
          locationId,
          supplierId,
          receiptNumber: 'GR-TEST-001',
          receivedAt: '2026-10-12T12:00:00.000Z',
          storageLocationId,
          lines: [
            {
              ingredientId,
              unitId: '66000000-0000-0000-0000-000000000002',
              lotCode: 'LOT-TEST',
              receivedOn: '2026-10-12',
              quantityReceived: '1001',
              unitCost: '0.028',
            },
          ],
        },
        '41000000-0000-0000-0000-000000000001',
        metadata(),
      ),
    ).rejects.toThrow('payload diferente');
  });

  it('rechaza reutilizar operationId con payload diferente', async () => {
    const operationId = '6d000000-0000-0000-0000-000000000001';
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      storageLocation: { findFirst: vi.fn().mockResolvedValue({ id: storageLocationId }) },
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue({
          id: operationId,
          storageLocationId,
          ingredientId,
          inventoryLotId: null,
          movementType: InventoryMovementType.Waste,
          quantityDelta: new Prisma.Decimal('-1'),
          unitCost: new Prisma.Decimal('0'),
          reason: 'Motivo original',
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.createAdjustment(
        {
          operationId,
          locationId,
          storageLocationId,
          ingredientId,
          movementType: InventoryMovementType.Waste,
          quantity: '2',
          unitCost: '0',
          reason: 'Motivo diferente',
        },
        '41000000-0000-0000-0000-000000000001',
        metadata(),
      ),
    ).rejects.toThrow('operationId ya fue usado');
  });

  it('rechaza un ajuste de salida que dejaría stock negativo', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      storageLocation: {
        findFirst: vi.fn().mockResolvedValue({ id: storageLocationId }),
      },
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantityDelta: new Prisma.Decimal('2') } }),
        create: vi.fn(),
      },
      ingredient: {
        findUnique: vi.fn().mockResolvedValue({ id: ingredientId, active: true, trackLots: false }),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.createAdjustment(
        {
          locationId,
          storageLocationId,
          ingredientId,
          movementType: InventoryMovementType.Waste,
          quantity: '3',
          unitCost: '0',
          reason: 'Producto dañado',
        },
        '41000000-0000-0000-0000-000000000001',
        metadata(),
      ),
    ).rejects.toThrow('stock por debajo de cero');

    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rechaza una salida que deja negativo el lote aunque el saldo agregado alcance', async () => {
    const lotId = '6a000000-0000-0000-0000-000000000001';
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      storageLocation: {
        findFirst: vi.fn().mockResolvedValue({ id: storageLocationId }),
      },
      inventoryLot: {
        findFirst: vi.fn().mockResolvedValue({ id: lotId }),
      },
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockImplementation(({ where }: { where: { inventoryLotId?: string } }) =>
          Promise.resolve({
            _sum: {
              quantityDelta: new Prisma.Decimal(where.inventoryLotId ? '1' : '5'),
            },
          }),
        ),
        create: vi.fn(),
      },
      ingredient: {
        findUnique: vi.fn().mockResolvedValue({ id: ingredientId, active: true, trackLots: true }),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.createAdjustment(
        {
          locationId,
          storageLocationId,
          ingredientId,
          inventoryLotId: lotId,
          movementType: InventoryMovementType.Waste,
          quantity: '2',
          unitCost: '0',
          reason: 'Producto dañado',
        },
        '41000000-0000-0000-0000-000000000001',
        metadata(),
      ),
    ).rejects.toThrow('stock del lote por debajo de cero');

    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('exige lote para una salida de un insumo trazable', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      storageLocation: {
        findFirst: vi.fn().mockResolvedValue({ id: storageLocationId }),
      },
      inventoryMovement: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      ingredient: {
        findUnique: vi.fn().mockResolvedValue({ id: ingredientId, active: true, trackLots: true }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new InventoryService(prisma as never);

    await expect(
      service.createAdjustment(
        {
          locationId,
          storageLocationId,
          ingredientId,
          movementType: InventoryMovementType.Waste,
          quantity: '1',
          unitCost: '0',
          reason: 'Producto dañado',
        },
        '41000000-0000-0000-0000-000000000001',
        metadata(),
      ),
    ).rejects.toThrow('Debe seleccionar un lote');
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
