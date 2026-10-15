import { describe, expect, it, vi } from 'vitest';

import { AnnouncementsService, validateCtaUrl } from './announcements.service.js';

const announcement = {
  id: 'announcement-1',
  locationId: 'location-1',
  title: 'Horario especial',
  message: 'Cerramos temprano.',
  ctaLabel: 'Reservar',
  ctaUrl: '/reservas',
  startsAt: null,
  endsAt: null,
  displayOrder: 0,
  active: true,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
};

describe('AnnouncementsService', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'ftp://evil.example',
    'https:\\evil.example',
    '//evil.example',
  ])('rechaza CTA con esquema o destino inseguro: %s', (ctaUrl) => {
    expect(() => validateCtaUrl(ctaUrl)).toThrow('URL HTTP(S) o una ruta relativa');
  });

  it('no actualiza un aviso de otra sede', async () => {
    const prisma = {
      importantAnnouncement: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new AnnouncementsService(prisma as never);

    await expect(service.update('announcement-1', 'location-2', { active: false })).rejects.toThrow(
      'Aviso importante no encontrado.',
    );
    expect(prisma.importantAnnouncement.findFirst).toHaveBeenCalledWith({
      where: { id: 'announcement-1', locationId: 'location-2' },
    });
  });

  it('actualiza usando la sede en el CAS de la mutación', async () => {
    const prisma = {
      importantAnnouncement: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(announcement)
          .mockResolvedValueOnce({
            ...announcement,
            active: false,
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ ...announcement, active: false }),
      },
    };
    const service = new AnnouncementsService(prisma as never);

    await expect(
      service.update('announcement-1', 'location-1', { active: false }),
    ).resolves.toMatchObject({ active: false });
    expect(prisma.importantAnnouncement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'announcement-1', locationId: 'location-1' } }),
    );
  });

  it('no desactiva un aviso de otra sede', async () => {
    const prisma = {
      importantAnnouncement: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new AnnouncementsService(prisma as never);

    await expect(service.remove('announcement-1', 'location-2')).rejects.toThrow(
      'Aviso importante no encontrado.',
    );
    expect(prisma.importantAnnouncement.updateMany).toHaveBeenCalledWith({
      where: { id: 'announcement-1', locationId: 'location-2' },
      data: { active: false },
    });
  });
});
