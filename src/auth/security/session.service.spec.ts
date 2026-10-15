import { describe, expect, it, vi } from 'vitest';

import { ConflictException } from '@nestjs/common';

import { SessionService, type SessionRecord } from './session.service.js';

const current: SessionRecord = {
  id: 'session-old',
  userId: 'user-1',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  expiresAt: new Date('2026-10-02T00:00:00.000Z'),
  revokedAt: null,
  lastUsedAt: new Date('2026-10-01T12:00:00.000Z'),
  mfaVerified: false,
};

const config = {
  cookieName: 'session',
  cookieSecure: false,
  sessionAbsoluteHours: 8,
};

describe('SessionService.rotateSession', () => {
  it('crea una sola sesión nueva cuando el CAS gana', async () => {
    const next = { ...current, id: 'session-new', mfaVerified: true };
    const tx = {
      userSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(next),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new SessionService(prisma as never, audit as never, config as never);

    const result = await service.rotateSession(
      current,
      true,
      { requestId: 'req-1' },
      'mfa_verified',
    );

    expect(result.record.id).toBe('session-new');
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: current.id, revokedAt: null }),
      }),
    );
    expect(tx.userSession.create).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('no crea sesión si otra solicitud ganó la revocación condicional', async () => {
    const tx = {
      userSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new SessionService(prisma as never, audit as never, config as never);

    await expect(
      service.rotateSession(current, true, { requestId: 'req-2' }, 'mfa_verified'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userSession.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('solo permite una rotación cuando dos solicitudes compiten por la misma sesión', async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const tx = {
      userSession: {
        updateMany,
        create: vi.fn().mockResolvedValue({ ...current, id: 'session-new' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new SessionService(prisma as never, audit as never, config as never);

    const results = await Promise.allSettled([
      service.rotateSession(current, true, { requestId: 'req-1' }, 'mfa_verified'),
      service.rotateSession(current, true, { requestId: 'req-2' }, 'mfa_verified'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(tx.userSession.create).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledTimes(2);
  });
});
