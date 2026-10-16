import { describe, expect, it, vi } from 'vitest';

import { AnalyticsController } from './analytics.controller.js';

const locationId = '20000000-0000-0000-0000-000000000001';

function request() {
  return {
    headers: { 'user-agent': 'Mozilla/5.0' },
    auth: { userId: 'user-1' },
  } as never;
}

describe('AnalyticsController', () => {
  it('delega la captura publica con el user-agent y respuesta vacía', async () => {
    const service = { recordPageView: vi.fn().mockResolvedValue(undefined) };
    const controller = new AnalyticsController(service as never, {} as never);

    await expect(
      controller.recordPageView({ path: '/', resourceType: 'page' } as never, request()),
    ).resolves.toBeUndefined();
    expect(service.recordPageView).toHaveBeenCalledWith(
      { path: '/', resourceType: 'page' },
      'Mozilla/5.0',
    );
  });

  it('comprueba el alcance de sede antes de devolver el resumen', async () => {
    const scope = { assertLocationAccess: vi.fn().mockResolvedValue(undefined) };
    const service = { getSummary: vi.fn().mockResolvedValue({ totalVisits: 0, daily: [] }) };
    const controller = new AnalyticsController(service as never, scope as never);

    await controller.summary({ locationId } as never, request());

    expect(scope.assertLocationAccess).toHaveBeenCalledWith('user-1', locationId);
    expect(service.getSummary).toHaveBeenCalledWith({ locationId });
  });
});
