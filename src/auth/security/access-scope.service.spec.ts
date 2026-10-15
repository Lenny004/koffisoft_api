import { describe, expect, it, vi } from 'vitest';

import { AccessScopeService } from './access-scope.service.js';

describe('AccessScopeService', () => {
  it('permite una sede del negocio de un rol activo', async () => {
    const prisma = {
      location: { findFirst: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          roles: [{ role: { businessId: 'business-1' } }],
        }),
      },
    };
    const service = new AccessScopeService(prisma as never);

    await expect(service.assertLocationAccess('actor-1', 'location-1')).resolves.toBeUndefined();
  });

  it('oculta una sede de otro negocio como no encontrada', async () => {
    const prisma = {
      location: { findFirst: vi.fn().mockResolvedValue({ businessId: 'business-2' }) },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          roles: [{ role: { businessId: 'business-1' } }],
        }),
      },
    };
    const service = new AccessScopeService(prisma as never);

    await expect(service.assertLocationAccess('actor-1', 'location-2')).rejects.toThrow(
      'Sede no encontrada.',
    );
  });
});
