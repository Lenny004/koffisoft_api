import { describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import { SeoController } from './seo.controller.js';

const locationId = '20000000-0000-0000-0000-000000000001';

function request(userId = 'actor-1') {
  return { auth: { userId } } as never;
}

describe('SeoController', () => {
  it('acota las lecturas administrativas a la sede autorizada', async () => {
    const scope = { assertLocationAccess: vi.fn().mockResolvedValue(undefined) };
    const service = { listAdmin: vi.fn().mockResolvedValue([]) };
    const controller = new SeoController(service as never, scope as never);

    await controller.listAdmin({ locationId }, request());

    expect(scope.assertLocationAccess).toHaveBeenCalledWith('actor-1', locationId);
    expect(service.listAdmin).toHaveBeenCalledWith({ locationId });
  });

  it('no lista SEO fuera del alcance', async () => {
    const scope = {
      assertLocationAccess: vi.fn().mockRejectedValue(new NotFoundException('Sede no encontrada.')),
    };
    const service = { listAdmin: vi.fn() };
    const controller = new SeoController(service as never, scope as never);

    await expect(controller.listAdmin({ locationId }, request())).rejects.toThrow(
      'Sede no encontrada.',
    );
    expect(service.listAdmin).not.toHaveBeenCalled();
  });
});
