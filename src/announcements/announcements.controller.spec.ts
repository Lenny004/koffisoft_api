import { describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import { AnnouncementsController } from './announcements.controller.js';

const locationId = '20000000-0000-0000-0000-000000000001';

function request(userId = 'actor-1') {
  return { auth: { userId } } as never;
}

describe('AnnouncementsController', () => {
  it('pasa locationId al alcance y al actualizar un aviso', async () => {
    const scope = { assertLocationAccess: vi.fn().mockResolvedValue(undefined) };
    const service = {
      update: vi.fn().mockResolvedValue({ id: 'announcement-1' }),
    };
    const controller = new AnnouncementsController(service as never, scope as never);

    await controller.update(
      'announcement-1',
      { active: false } as never,
      { locationId },
      request(),
    );

    expect(scope.assertLocationAccess).toHaveBeenCalledWith('actor-1', locationId);
    expect(service.update).toHaveBeenCalledWith('announcement-1', locationId, { active: false });
  });

  it('no ejecuta la mutación de un aviso fuera del alcance', async () => {
    const scope = {
      assertLocationAccess: vi.fn().mockRejectedValue(new NotFoundException('Sede no encontrada.')),
    };
    const service = { remove: vi.fn() };
    const controller = new AnnouncementsController(service as never, scope as never);

    await expect(controller.remove('announcement-1', { locationId }, request())).rejects.toThrow(
      'Sede no encontrada.',
    );
    expect(service.remove).not.toHaveBeenCalled();
  });
});
