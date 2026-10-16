import { describe, expect, it, vi } from 'vitest';

import { SeoService, validateHttpUrl } from './seo.service.js';

const location = {
  id: '20000000-0000-0000-0000-000000000001',
  businessId: '10000000-0000-0000-0000-000000000001',
  name: 'Sede principal',
  business: {
    tradeName: 'Koffi-Soft',
    siteProfile: { heroImageUrl: 'https://site.example/hero.jpg' },
  },
};

function createService() {
  const prisma = {
    location: {
      findFirst: vi.fn().mockResolvedValue(location),
      findMany: vi.fn().mockResolvedValue([location]),
    },
    menuItem: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    event: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    importantAnnouncement: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    seoMetadata: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const service = new SeoService(
    prisma as never,
    {
      publicSiteUrl: 'https://site.example',
    } as never,
  );
  return { service, prisma };
}

describe('SeoService', () => {
  it('resuelve defaults de página con canonical e imagen', async () => {
    const { service } = createService();

    await expect(
      service.getPublic({ resourceType: 'page', resourceKey: 'home' }),
    ).resolves.toMatchObject({
      metaTitle: 'Koffi-Soft | Cafe, cocina y montana',
      canonicalUrl: 'https://site.example/',
      ogImageUrl: 'https://site.example/hero.jpg',
      noindex: false,
    });
  });

  it('rechaza URLs OG o canonical inseguras', () => {
    expect(() => validateHttpUrl('javascript:alert(1)', 'La imagen OG')).toThrow('HTTP(S)');
    expect(() => validateHttpUrl('https://user:pass@example.com/a', 'La URL canónica')).toThrow(
      'HTTP(S)',
    );
  });

  it('respeta noindex y overrides de canonical publicados', async () => {
    const { service, prisma } = createService();
    prisma.seoMetadata.findFirst.mockResolvedValue({
      id: 'seo-1',
      businessId: location.businessId,
      locationId: null,
      resourceType: 'page',
      resourceKey: 'home',
      metaTitle: 'Inicio privado',
      metaDescription: 'No indexar esta variante.',
      ogImageUrl: null,
      canonicalUrl: 'https://site.example/inicio',
      noindex: true,
      updatedAt: new Date('2026-10-10T00:00:00.000Z'),
    });

    await expect(
      service.getPublic({ resourceType: 'page', resourceKey: 'home' }),
    ).resolves.toMatchObject({
      metaTitle: 'Inicio privado',
      canonicalUrl: 'https://site.example/inicio',
      noindex: true,
    });
  });

  it('genera sitemap con paginas base sin depender de overrides', async () => {
    const { service } = createService();

    await expect(service.getSitemapXml()).resolves.toContain(
      '<loc>https://site.example/carta</loc>',
    );
  });

  it('genera robots con el origen público configurado', () => {
    const { service } = createService();

    expect(service.getRobotsTxt()).toContain('Sitemap: https://site.example/sitemap.xml');
    expect(service.getRobotsTxt()).toContain('Disallow: /admin');
  });
});
