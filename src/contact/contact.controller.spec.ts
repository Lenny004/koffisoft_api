import { describe, expect, it, vi } from 'vitest';

import { ContactController } from './contact.controller.js';

const locationId = '20000000-0000-0000-0000-000000000001';

function request() {
  return { ip: '127.0.0.1', auth: { userId: 'user-1' }, id: 'request-1' } as never;
}

describe('ContactController', () => {
  it('comprueba la sede antes de listar la bandeja', async () => {
    const scope = { assertLocationAccess: vi.fn().mockResolvedValue(undefined) };
    const service = { list: vi.fn().mockResolvedValue({ data: [], meta: {} }) };
    const controller = new ContactController(service as never, scope as never);

    await controller.list({ locationId } as never, request());

    expect(scope.assertLocationAccess).toHaveBeenCalledWith('user-1', locationId);
    expect(service.list).toHaveBeenCalledWith({ locationId });
  });

  it('no actualiza un mensaje si la sede queda fuera del alcance', async () => {
    const scope = {
      assertLocationAccess: vi.fn().mockRejectedValue(new Error('Sede no encontrada.')),
    };
    const service = { update: vi.fn() };
    const controller = new ContactController(service as never, scope as never);

    await expect(
      controller.update('message-1', locationId, {} as never, request()),
    ).rejects.toThrow('Sede no encontrada.');
    expect(service.update).not.toHaveBeenCalled();
  });
});
