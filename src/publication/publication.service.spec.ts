import { describe, expect, it, vi } from 'vitest';

import { PublicationStatus } from '../generated/prisma/enums.js';
import { PublicationService } from './publication.service.js';

const locationId = '20000000-0000-0000-0000-000000000001';
const announcementId = '30000000-0000-0000-0000-000000000001';

function announcementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: announcementId,
    locationId,
    publicationStatus: PublicationStatus.Draft,
    publishedAt: null,
    scheduledAt: null,
    expiresAt: null,
    previewTokenHash: null,
    previewExpiresAt: null,
    location: { timezone: 'America/El_Salvador' },
    title: 'Aviso de prueba',
    message: 'Mensaje de prueba',
    ctaLabel: null,
    ctaUrl: null,
    startsAt: null,
    endsAt: null,
    displayOrder: 0,
    active: true,
    ...overrides,
  };
}

function serviceFor(row = announcementRow()) {
  const tx = {
    importantAnnouncement: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    location: {
      findFirst: vi.fn().mockResolvedValue({ id: locationId, timezone: 'America/El_Salvador' }),
    },
    importantAnnouncement: {
      findUnique: vi.fn().mockResolvedValue(row),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    menuItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
    event: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return { service: new PublicationService(prisma as never), prisma, tx };
}

describe('PublicationService', () => {
  it('devuelve la zona horaria editorial de la sede', async () => {
    const { service } = serviceFor();

    await expect(service.getContext(locationId)).resolves.toEqual({
      locationId,
      timezone: 'America/El_Salvador',
    });
  });

  it('programa en el futuro y registra la transición editorial', async () => {
    const { service, tx } = serviceFor();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await expect(
      service.updatePublication(
        'announcement',
        announcementId,
        locationId,
        { action: 'schedule', scheduledAt },
        'user-1',
      ),
    ).resolves.toMatchObject({
      publicationStatus: PublicationStatus.Scheduled,
      scheduledAt,
    });

    expect(tx.importantAnnouncement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: announcementId },
        data: expect.objectContaining({
          publicationStatus: PublicationStatus.Scheduled,
          scheduledAt: new Date(scheduledAt),
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'content.schedule' }) }),
    );
  });

  it('rechaza una programación en el pasado', async () => {
    const { service, tx } = serviceFor();

    await expect(
      service.updatePublication(
        'announcement',
        announcementId,
        locationId,
        { action: 'schedule', scheduledAt: '2020-01-01T00:00:00.000Z' },
        'user-1',
      ),
    ).rejects.toThrow('fecha programada debe estar en el futuro');
    expect(tx.importantAnnouncement.update).not.toHaveBeenCalled();
  });

  it('aplica de forma idempotente publicaciones programadas y expiradas', async () => {
    const now = new Date('2026-10-15T18:00:00.000Z');
    const { service, prisma, tx } = serviceFor();
    const scheduled = announcementRow({
      publicationStatus: PublicationStatus.Scheduled,
      scheduledAt: new Date('2026-10-15T17:00:00.000Z'),
    });
    const expired = announcementRow({
      publicationStatus: PublicationStatus.Published,
      publishedAt: new Date('2026-10-01T17:00:00.000Z'),
      expiresAt: new Date('2026-10-15T17:00:00.000Z'),
    });
    prisma.importantAnnouncement.findMany
      .mockResolvedValueOnce([scheduled])
      .mockResolvedValueOnce([expired]);

    await expect(service.processDueTransitions(now)).resolves.toBe(2);
    expect(tx.importantAnnouncement.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'content.auto_publish' }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'content.auto_expire' }) }),
    );
  });

  it('cancela una programacion al devolver el contenido a borrador', async () => {
    const row = announcementRow({
      publicationStatus: PublicationStatus.Scheduled,
      scheduledAt: new Date('2026-10-20T17:00:00.000Z'),
    });
    const { service, tx } = serviceFor(row);

    await expect(
      service.updatePublication(
        'announcement',
        announcementId,
        locationId,
        { action: 'unpublish' },
        'user-1',
      ),
    ).resolves.toMatchObject({ publicationStatus: PublicationStatus.Draft });
    expect(tx.importantAnnouncement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicationStatus: PublicationStatus.Draft,
          scheduledAt: null,
          publishedAt: null,
          expiresAt: null,
        }),
      }),
    );
  });

  it('genera una vista previa de un solo uso y no expone campos internos', async () => {
    const row = announcementRow({ previewTokenHash: 'hash-not-used' });
    const { service, prisma } = serviceFor(row);
    const token = await service.createPreview('announcement', announcementId, locationId, 'user-1');
    expect(token.previewPath).toMatch(/^\/preview\/[A-Za-z0-9_-]+$/u);
    expect(token.expiresAt).toBeTruthy();

    prisma.importantAnnouncement.findFirst.mockResolvedValueOnce(row);
    await expect(
      service.consumePreview(token.previewPath.slice('/preview/'.length)),
    ).resolves.toMatchObject({
      resourceType: 'announcement',
      resource: { title: 'Aviso de prueba', message: 'Mensaje de prueba' },
    });
    expect(prisma.importantAnnouncement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { previewTokenHash: null, previewExpiresAt: null } }),
    );

    prisma.importantAnnouncement.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.consumePreview(token.previewPath.slice('/preview/'.length)),
    ).rejects.toThrow('no encontrada o expirada');
    expect(prisma.importantAnnouncement.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          previewExpiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      }),
    );
  });
});
