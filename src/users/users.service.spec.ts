import { describe, expect, it, vi } from 'vitest';

import { EmployeeStatus, JobCode, UserStatus } from '../generated/prisma/enums.js';
import { UsersService } from './users.service.js';

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.invalid',
    status: UserStatus.Active,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedAt: null,
    lockedUntil: null,
    lastLoginAt: null,
    emailVerifiedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    employee: null,
    roles: [],
    mfaFactors: [],
    ...overrides,
  };
}

function transactionPrisma(tx: Record<string, unknown>) {
  tx.$executeRaw ??= vi.fn().mockResolvedValue(undefined);
  return {
    $transaction: vi.fn(async (operation: unknown) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      return (operation as (client: unknown) => Promise<unknown>)(tx);
    }),
  };
}

describe('UsersService', () => {
  it('impide que un administrador desactive su propia cuenta', async () => {
    const prisma = transactionPrisma({});
    const service = new UsersService(prisma as never, {} as never);

    await expect(
      service.deactivateUser('user-1', 'user-1', { requestId: 'req-1' }),
    ).rejects.toThrow('No puede desactivar su propia cuenta.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('impide quitar el último administrador activo', async () => {
    const current = userRow({
      roles: [{ active: true, role: { id: 'role-1', code: 'admin', name: 'Admin', active: true } }],
    });
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(current), count: vi.fn().mockResolvedValue(0) },
    };
    const service = new UsersService(transactionPrisma(tx) as never, {} as never);

    await expect(
      service.deactivateUser('user-1', 'actor-1', { requestId: 'req-1' }),
    ).rejects.toThrow('No puede dejar el sistema sin un administrador activo.');
    expect(tx.user.count).toHaveBeenCalled();
  });

  it('impide que un usuario se quite su propio rol administrador', async () => {
    const current = userRow({
      roles: [{ active: true, role: { id: 'role-1', code: 'admin', name: 'Admin', active: true } }],
    });
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(current) },
      role: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new UsersService(transactionPrisma(tx) as never, {} as never);

    await expect(
      service.assignRoles('user-1', { roleIds: [] }, 'user-1', { requestId: 'req-1' }),
    ).rejects.toThrow('No puede quitarse su propio rol administrador.');
  });

  it('marca el cambio obligatorio sin guardar material de autenticación en auditoría', async () => {
    const current = userRow();
    const updated = userRow({ mustChangePassword: true });
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue(updated),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const service = new UsersService(transactionPrisma(tx) as never, {} as never);

    await expect(
      service.forcePasswordChange('user-1', 'actor-1', { requestId: 'req-1' }),
    ).resolves.toMatchObject({ mustChangePassword: true });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mustChangePassword: true } }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ passwordHash: expect.anything() }),
      }),
    );
  });

  it('pagina usuarios en el servidor', async () => {
    const rows = [userRow({ id: 'user-2', username: 'bravo' })];
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(21),
        findMany: vi.fn().mockResolvedValue(rows),
      },
      ...transactionPrisma({}),
    };
    const service = new UsersService(prisma as never, {} as never);

    await expect(service.listUsers({ page: 2, pageSize: 10 })).resolves.toMatchObject({
      data: [{ id: 'user-2' }],
      meta: { page: 2, pageSize: 10, total: 21, totalPages: 3 },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('mapea empleados con vínculo opcional a usuario', async () => {
    const employee = {
      id: 'employee-1',
      locationId: 'location-1',
      employeeCode: 'EMP-001',
      firstName: 'Ana',
      lastName: 'Rivera',
      jobCode: JobCode.Manager,
      status: EmployeeStatus.Active,
      phone: null,
      email: null,
      hireDate: new Date('2026-01-01T00:00:00.000Z'),
      terminationDate: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { id: 'user-1', username: 'ana', status: UserStatus.Active },
    };
    const prisma = {
      employee: { findUnique: vi.fn().mockResolvedValue(employee) },
    };
    const service = new UsersService(prisma as never, {} as never);

    await expect(service.getEmployee('employee-1')).resolves.toMatchObject({
      id: 'employee-1',
      user: { id: 'user-1', username: 'ana' },
    });
  });
});
