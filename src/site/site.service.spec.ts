import { describe, expect, it, vi } from 'vitest';

import { SiteService } from './site.service.js';

const row = {
  id: '20000000-0000-0000-0000-000000000001',
  businessId: '10000000-0000-0000-0000-000000000001',
  name: 'Koffi-Soft',
  addressLine: 'Km 20',
  municipality: 'Comasagua',
  department: 'La Libertad',
  phone: '+503 7000',
  email: 'hola@koffisoft.com',
  latitude: 13.7,
  longitude: -89.25,
  timezone: 'America/El_Salvador',
  active: true,
  locationHours: [
    {
      id: 'hour-1',
      serviceType: 'public',
      dayOfWeek: 1,
      opensAt: new Date('1970-01-01T08:00:00Z'),
      closesAt: new Date('1970-01-01T18:00:00Z'),
      crossesMidnight: false,
      active: true,
    },
  ],
  hourOverrides: [],
  business: {
    siteProfile: {
      id: 'profile-1',
      businessId: '10000000-0000-0000-0000-000000000001',
      heroEyebrow: 'Café',
      heroTitle: 'Una pausa',
      heroDescription: 'Descripción',
      heroImageUrl: null,
      aboutTitle: 'Nosotros',
      aboutDescription: 'Historia',
      aboutMission: 'Misión',
      aboutVision: 'Visión',
      aboutTeam: [{ name: 'Equipo', role: 'Hospitalidad', description: 'Cercanía' }],
      socialFacebookUrl: null,
      socialInstagramUrl: null,
      socialTikTokUrl: null,
      updatedAt: new Date('2026-10-15T00:00:00Z'),
    },
  },
};

describe('SiteService', () => {
  it('mapea sede, horarios y perfil editorial', async () => {
    const prisma = { location: { findUnique: vi.fn().mockResolvedValue(row) } };
    await expect(new SiteService(prisma as never).getSite(row.id)).resolves.toMatchObject({
      locationId: row.id,
      location: { latitude: 13.7 },
      hours: [{ opensAt: '08:00', closesAt: '18:00' }],
      profile: { heroTitle: 'Una pausa' },
    });
  });

  it('rechaza una ventana inválida antes de consultar la base', async () => {
    const prisma = { location: { findUnique: vi.fn() } };
    const dto = {
      location: { addressLine: 'A', municipality: 'B', department: 'C' },
      profile: {
        heroEyebrow: 'E',
        heroTitle: 'T',
        heroDescription: 'D',
        aboutTitle: 'A',
        aboutDescription: 'D',
        aboutMission: 'M',
        aboutVision: 'V',
        aboutTeam: [],
      },
      hours: [
        {
          serviceType: 'public',
          dayOfWeek: 1,
          opensAt: '18:00',
          closesAt: '08:00',
          crossesMidnight: false,
          active: true,
        },
      ],
      overrides: [],
    } as never;
    await expect(
      new SiteService(prisma as never).updateSite(row.id, dto, 'user-1', {} as never),
    ).rejects.toThrow('La hora final debe ser posterior');
    expect(prisma.location.findUnique).not.toHaveBeenCalled();
  });
});
