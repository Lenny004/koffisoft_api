import { describe, expect, it, vi } from 'vitest';

import { PublicationController } from './publication.controller.js';

const request = (permissions: string[]) =>
  ({
    auth: { userId: 'user-1', permissions },
  }) as never;

describe('PublicationController', () => {
  it('oculta la mutación cuando falta el permiso del recurso', async () => {
    const service = { updatePublication: vi.fn() };
    const scope = { assertLocationAccess: vi.fn() };
    const controller = new PublicationController(service as never, scope as never);

    await expect(
      controller.update(
        'announcement',
        '30000000-0000-0000-0000-000000000001',
        { locationId: '20000000-0000-0000-0000-000000000001' },
        request(['content.publish']),
        { action: 'publish' },
      ),
    ).rejects.toThrow('important_announcements.read');
    expect(service.updatePublication).not.toHaveBeenCalled();
  });

  it('permite publicar solo con lectura y administración del recurso', async () => {
    const service = {
      updatePublication: vi.fn().mockResolvedValue({ publicationStatus: 'Published' }),
    };
    const scope = { assertLocationAccess: vi.fn() };
    const controller = new PublicationController(service as never, scope as never);
    const query = { locationId: '20000000-0000-0000-0000-000000000001' };

    await controller.update(
      'announcement',
      '30000000-0000-0000-0000-000000000001',
      query,
      request([
        'content.publish',
        'important_announcements.read',
        'important_announcements.manage',
      ]),
      { action: 'publish' },
    );
    expect(scope.assertLocationAccess).toHaveBeenCalledWith('user-1', query.locationId);
    expect(service.updatePublication).toHaveBeenCalled();
  });
});
