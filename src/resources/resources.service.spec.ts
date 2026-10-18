import { describe, expect, it, vi } from 'vitest';

import { ResourcesService } from './resources.service.js';

describe('ResourcesService', () => {
  it('lista mantenimientos globales de una sede con filtros y paginación', async () => {
    const locationId = 'loc-1';
    const row = {
      id: 'maint-1',
      resourceId: 'res-1',
      scheduledDate: new Date('2026-10-20'),
      description: 'Calibración',
      completed: false,
      completedAt: null,
      completedByUserId: null,
      notes: null,
      createdAt: new Date('2026-10-01'),
      resource: { locationId, resourceCode: 'EQ-01', name: 'Horno' },
    };
    const prisma = {
      location: { findFirst: vi.fn().mockResolvedValue({ id: locationId }) },
      resource: { findFirst: vi.fn() },
      resourceMaintenanceSchedule: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([row]),
      },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new ResourcesService(prisma as never);

    const result = await service.listMaintenances({
      locationId,
      completed: false,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      page: 1,
      pageSize: 20,
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'maint-1',
      resourceCode: 'EQ-01',
      resourceName: 'Horno',
      completed: false,
    });
    expect(prisma.resourceMaintenanceSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          completed: false,
          resource: { locationId },
        }),
      }),
    );
  });

  it('lista el historial de mantenimientos completados de un recurso', async () => {
    const prisma = {
      location: { findFirst: vi.fn() },
      resource: { findFirst: vi.fn().mockResolvedValue({ id: 'res-1' }) },
      resourceMaintenanceSchedule: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'maint-2',
            resourceId: 'res-1',
            scheduledDate: new Date('2026-09-01'),
            description: 'Limpieza',
            completed: true,
            completedAt: new Date('2026-09-02'),
            completedByUserId: 'user-1',
            notes: 'Ok',
            createdAt: new Date('2026-08-20'),
            resource: { locationId: 'loc-1', resourceCode: 'EQ-01', name: 'Horno' },
          },
        ]),
      },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new ResourcesService(prisma as never);

    const result = await service.listMaintenances({
      resourceId: 'res-1',
      completed: true,
      page: 1,
      pageSize: 20,
    });

    expect(result.data[0]?.completed).toBe(true);
    expect(prisma.resourceMaintenanceSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { resourceId: 'res-1', completed: true },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('exige locationId o resourceId para listar mantenimientos', async () => {
    const service = new ResourcesService({} as never);

    await expect(service.listMaintenances({ page: 1, pageSize: 20 })).rejects.toThrow(
      'Indica locationId o resourceId',
    );
  });
});
