import { describe, expect, it, vi } from 'vitest';

import { UserStatus, AuthEventType } from '../generated/prisma/enums.js';
import type { AppConfig } from '../config/app-config.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('bloquea temporalmente la cuenta al alcanzar el umbral de fallos', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-1',
          passwordHash: 'hash',
          status: UserStatus.Active,
          failedLoginAttempts: 4,
          lockedUntil: null,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const passwords = {
      verify: vi.fn().mockResolvedValue(false),
      needsRehash: vi.fn(),
      burn: vi.fn(),
      hash: vi.fn(),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      prisma as never,
      passwords as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      {
        loginMaxAttempts: 5,
        loginLockMinutes: 15,
      } as AppConfig,
    );

    await expect(
      service.login(
        { email: 'user@example.com', password: 'Incorrect Password 123!' },
        { ipAddress: '127.0.0.1', userAgent: 'vitest' },
      ),
    ).rejects.toThrow('Credenciales inválidas.');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: UserStatus.Locked,
          failedLoginAttempts: 5,
          lockedAt: expect.any(Date),
          lockedUntil: expect.any(Date),
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      AuthEventType.AccountLocked,
      expect.anything(),
      expect.objectContaining({ userId: 'user-1' }),
    );
  });
});
