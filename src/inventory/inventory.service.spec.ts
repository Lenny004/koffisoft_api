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
        findUnique: vi.fn().mockResolvedValue({ id: ingredientId, active: true }),
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
});
