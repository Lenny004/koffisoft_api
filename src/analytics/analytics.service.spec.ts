import { describe, expect, it, vi } from 'vitest';

import {
  isBotUserAgent,
  isPreviewPath,
  normalizePath,
  normalizeRefererHost,
  AnalyticsService,
} from './analytics.service.js';

const location = {
  id: '20000000-0000-0000-0000-000000000001',
  businessId: '10000000-0000-0000-0000-000000000001',
  timezone: 'America/El_Salvador',
};

function createService() {
  const prisma = {
    pageView: {
      upsert: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    location: {
      findFirst: vi.fn().mockResolvedValue(location),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ roles: [] }) },
  };
  return { service: new AnalyticsService(prisma as never), prisma };
}

describe('normalización de analíticas', () => {
  it('conserva solo el path y el dominio del referer', () => {
    expect(normalizePath('/carta//cafe-de-la-casa?utm_source=red')).toBe('/carta/cafe-de-la-casa');
    expect(normalizeRefererHost('https://www.Example.com/resultados?q=cafe')).toBe(
      'www.example.com',
    );
  });

  it('descarta URL externas, bots y vistas previas', () => {
    expect(normalizePath('https://otro.example/carta')).toBeNull();
    expect(isBotUserAgent('Mozilla/5.0 Googlebot/2.1')).toBe(true);
    expect(isPreviewPath('/preview/token')).toBe(true);
  });
});

describe('AnalyticsService', () => {
  it('agrega visitas sin persistir IP ni cookies', async () => {
    const { service, prisma } = createService();

    await service.recordPageView(
      {
        locationId: location.id,
        path: '/carta/cafe-de-la-casa?utm_source=red',
        resourceType: 'menu_item',
        resourceKey: 'cafe-de-la-casa',
        referer: 'https://search.example/resultados',
        isPreview: false,
      } as never,
      'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
    );

    expect(prisma.pageView.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          path: '/carta/cafe-de-la-casa',
          resourceType: 'menu_item',
          refererHost: 'search.example',
          viewCount: 1,
        }),
      }),
    );
    expect(JSON.stringify(prisma.pageView.upsert.mock.calls[0])).not.toContain('ipAddress');
    expect(prisma.pageView.deleteMany).toHaveBeenCalledOnce();
  });

  it('ignora bots y previews antes de consultar la sede', async () => {
    const { service, prisma } = createService();

    await service.recordPageView(
      { path: '/preview/one', resourceType: 'page', isPreview: false } as never,
      'Googlebot/2.1',
    );

    expect(prisma.location.findFirst).not.toHaveBeenCalled();
    expect(prisma.pageView.upsert).not.toHaveBeenCalled();
  });

  it('construye una serie diaria y limita el rango', async () => {
    const { service, prisma } = createService();
    prisma.pageView.groupBy.mockResolvedValue([
      { occurredAt: new Date('2026-10-14T00:00:00.000Z'), _sum: { viewCount: 4 } },
      { occurredAt: new Date('2026-10-15T00:00:00.000Z'), _sum: { viewCount: 2 } },
    ]);

    await expect(
      service.getSummary({
        locationId: location.id,
        from: '2026-10-14',
        to: '2026-10-15',
      }),
    ).resolves.toEqual({
      totalVisits: 6,
      daily: [
        { date: '2026-10-14', visits: 4 },
        { date: '2026-10-15', visits: 2 },
      ],
    });

    await expect(
      service.getSummary({
        locationId: location.id,
        from: '2025-01-01',
        to: '2026-10-15',
      }),
    ).rejects.toThrow('no puede superar');
  });
});
