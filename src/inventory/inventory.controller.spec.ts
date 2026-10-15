import { describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import { InventoryController } from './inventory.controller.js';

const locationId = '20000000-0000-0000-0000-000000000001';

function request(userId = 'actor-1') {
  return { auth: { userId } } as never;
}

describe('InventoryController', () => {
  it('comprueba el alcance de sede antes de listar ingredientes', async () => {
    const scope = { assertLocationAccess: vi.fn().mockResolvedValue(undefined) };
    const service = { listIngredients: vi.fn().mockResolvedValue({ data: [], meta: {} }) };
    const controller = new InventoryController(service as never, scope as never);

    await controller.listIngredients({ locationId } as never, request());

    expect(scope.assertLocationAccess).toHaveBeenCalledWith('actor-1', locationId);
    expect(service.listIngredients).toHaveBeenCalledWith({ locationId });
  });

  it('no ejecuta la operación si la sede está fuera del alcance', async () => {
    const scope = {
      assertLocationAccess: vi.fn().mockRejectedValue(new NotFoundException('Sede no encontrada.')),
    };
    const service = { listIngredients: vi.fn() };
    const controller = new InventoryController(service as never, scope as never);

    await expect(controller.listIngredients({ locationId } as never, request())).rejects.toThrow(
      'Sede no encontrada.',
    );
    expect(service.listIngredients).not.toHaveBeenCalled();
  });
});
