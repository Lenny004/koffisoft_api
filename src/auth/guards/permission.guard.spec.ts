import { describe, expect, it, vi } from 'vitest';

import { PermissionGuard } from './permission.guard.js';

function executionContext(auth?: { permissions: string[] }) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as never;
}

describe('PermissionGuard', () => {
  it('permite cuando todos los permisos requeridos son efectivos', () => {
    const reflector = { getAllAndOverride: vi.fn(() => ['orders.read', 'orders.create']) };
    const guard = new PermissionGuard(reflector as never);

    expect(
      guard.canActivate(executionContext({ permissions: ['orders.read', 'orders.create'] })),
    ).toBe(true);
  });

  it('rechaza con 403 cuando falta un permiso', () => {
    const reflector = { getAllAndOverride: vi.fn(() => ['orders.manage']) };
    const guard = new PermissionGuard(reflector as never);

    expect(() => guard.canActivate(executionContext({ permissions: ['orders.read'] }))).toThrow(
      'No tiene permisos suficientes.',
    );
  });
});
