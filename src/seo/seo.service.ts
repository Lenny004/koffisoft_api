import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type {
  CreateSeoMetadataDto,
  PublicSeoQueryDto,
  SeoListQueryDto,
  SeoResourceType,
  UpdateSeoMetadataDto,
} from './dto/seo.dto.js';
import type { SeoMetadataResponseDto } from './dto/seo-response.dto.js';

const PAGE_DEFAULTS: Record<string, { title: string; description: string; path: string }> = {
  home: {
    title: 'Koffi-Soft | Cafe, cocina y montana',
    description: 'Descubre cafe, cocina y experiencias con vista en la Ruta Panoramica.',
    path: '/',
  },
  menu: {
    title: 'Carta | Koffi-Soft',
    description: 'Consulta la carta publica de Koffi-Soft y sus opciones disponibles.',
    path: '/carta',
  },
  promotions: {
    title: 'Promociones | Koffi-Soft',
    description: 'Conoce las novedades y promociones de Koffi-Soft.',
    path: '/promociones',
  },
  reservations: {
    title: 'Reservas | Koffi-Soft',
    description: 'Elige fecha, hora y personas para solicitar tu reserva en Koffi-Soft.',
    path: '/reservas',
  },
  events: {
    title: 'Eventos | Koffi-Soft',
    description: 'Conoce los espacios para eventos y solicita una cotizacion.',
    path: '/eventos',
  },
  announcements: {
    title: 'Avisos importantes | Koffi-Soft',
    description: 'Consulta los avisos importantes publicados por Koffi-Soft.',
    path: '/avisos',
  },
  about: {
    title: 'Nosotros | Koffi-Soft',
    description: 'Conoce la mision, vision y equipo de Koffi-Soft.',
    path: '/nosotros',
  },
  location: {
    title: 'Ubicacion | Koffi-Soft',
    description: 'Consulta la ubicacion y el horario antes de visitarnos.',
    path: '/ubicacion',
  },
  contact: {
    title: 'Contacto | Koffi-Soft',
    description: 'Escribenos para resolver tus dudas sobre reservas y eventos.',
    path: '/contacto',
  },
  hiking: {
    title: 'Senderismo | Koffi-Soft',
    description: 'Descubre la experiencia de montana en la Ruta Panoramica.',
    path: '/senderismo',
  },
  allergens: {
    title: 'Alergenos | Koffi-Soft',
    description: 'Consulta la informacion de alergenos de la carta publicada.',
    path: '/alergenos',
  },
  legal: {
    title: 'Terminos y condiciones | Koffi-Soft',
    description: 'Consulta los terminos de uso del sitio de Koffi-Soft.',
    path: '/legal',
  },
  privacy: {
    title: 'Privacidad | Koffi-Soft',
    description: 'Consulta la politica de privacidad de Koffi-Soft.',
    path: '/privacidad',
  },
  cookies: {
    title: 'Cookies | Koffi-Soft',
    description: 'Consulta el uso de cookies en el sitio de Koffi-Soft.',
    path: '/cookies',
  },
  conditions: {
    title: 'Condiciones | Koffi-Soft',
    description: 'Consulta las condiciones de servicio de Koffi-Soft.',
    path: '/condiciones',
  },
};

const PUBLIC_EVENT_STATUSES = new Set(['Confirmed', 'InProgress', 'Completed']);

interface SeoRow {
  id: string;
  businessId: string | null;
  locationId: string | null;
  resourceType: SeoResourceType;
  resourceKey: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  updatedAt: Date;
}

interface SeoDelegate {
  findFirst(args: { where: Record<string, unknown>; orderBy?: unknown }): Promise<SeoRow | null>;
  findMany(args: { where: Record<string, unknown>; orderBy?: unknown }): Promise<SeoRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<SeoRow>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<SeoRow>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

interface LocationContext {
  businessId: string;
  locationId: string;
  tradeName: string;
  heroImageUrl: string | null;
}

interface ResolvedResource extends LocationContext {
  title: string;
  description: string;
  path: string;
  storedLocationId: string | null;
}

/** Resuelve defaults SEO desde recursos publicados y guarda solo overrides editoriales. */
@Injectable()
export class SeoService {
  private readonly seo: SeoDelegate;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.seo = (prisma as PrismaService & { seoMetadata: SeoDelegate }).seoMetadata;
  }

  async getPublic(query: PublicSeoQueryDto): Promise<SeoMetadataResponseDto> {
    const resource = await this.resolveResource(
      query.resourceType,
      query.resourceKey,
      query.locationId,
      false,
    );
    const row = await this.findOverride(resource, query.resourceType, query.resourceKey);
    return this.toResponse(row, resource, query.resourceType, query.resourceKey);
  }

  async listAdmin(query: SeoListQueryDto): Promise<SeoMetadataResponseDto[]> {
    const location = await this.getLocation(query.locationId);
    const rows = await this.seo.findMany({
      where: {
        businessId: location.businessId,
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        OR: [{ locationId: null }, { locationId: query.locationId }],
      },
      orderBy: [{ resourceType: 'asc' }, { resourceKey: 'asc' }],
    });

    const [menuItems, events, announcements] = await Promise.all([
      this.prisma.menuItem.findMany({
        where: {
          active: true,
          publicVisible: true,
          category: { locationId: query.locationId, active: true },
          variants: { some: { active: true } },
        },
        select: { slug: true },
        orderBy: { slug: 'asc' },
      }),
      this.prisma.event.findMany({
        where: {
          locationId: query.locationId,
          status: { in: [...PUBLIC_EVENT_STATUSES] as never[] },
        },
        select: { id: true },
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.importantAnnouncement.findMany({
        where: {
          locationId: query.locationId,
          active: true,
          OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
        },
        select: { id: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const candidates = [
      ...Object.keys(PAGE_DEFAULTS).map((resourceKey) => ({
        resourceType: 'page' as const,
        resourceKey,
      })),
      ...menuItems.map(({ slug }) => ({ resourceType: 'menu_item' as const, resourceKey: slug })),
      ...events.map(({ id }) => ({ resourceType: 'event' as const, resourceKey: id })),
      ...announcements.map(({ id }) => ({
        resourceType: 'announcement' as const,
        resourceKey: id,
      })),
    ].filter(({ resourceType }) => !query.resourceType || resourceType === query.resourceType);

    const existing = rows.filter((row) =>
      candidates.some(
        (candidate) =>
          candidate.resourceType === row.resourceType && candidate.resourceKey === row.resourceKey,
      ),
    );
    const all = [
      ...candidates,
      ...existing
        .filter(
          (row) =>
            !candidates.some(
              (candidate) =>
                candidate.resourceType === row.resourceType &&
                candidate.resourceKey === row.resourceKey,
            ),
        )
        .map(({ resourceType, resourceKey }) => ({ resourceType, resourceKey })),
    ];

    return Promise.all(
      all.map(async ({ resourceType, resourceKey }) => {
        const resource = await this.resolveResource(
          resourceType,
          resourceKey,
          query.locationId,
          true,
        );
        const row = rows
          .filter(
            (candidate) =>
              candidate.resourceType === resourceType && candidate.resourceKey === resourceKey,
          )
          .sort(
            (left, right) => Number(Boolean(right.locationId)) - Number(Boolean(left.locationId)),
          )[0];
        return this.toResponse(row ?? null, resource, resourceType, resourceKey);
      }),
    );
  }

  async create(dto: CreateSeoMetadataDto): Promise<SeoMetadataResponseDto> {
    const resource = await this.resolveResource(
      dto.resourceType,
      dto.resourceKey,
      dto.locationId,
      true,
    );
    const existing = await this.findOverride(resource, dto.resourceType, dto.resourceKey);
    if (existing) throw new ConflictException('Ya existe SEO para este recurso.');

    const defaults = this.defaultValues(resource, dto.resourceType, dto.resourceKey);
    const row = await this.seo.create({
      data: {
        businessId: resource.businessId,
        locationId: resource.storedLocationId,
        resourceType: dto.resourceType,
        resourceKey: dto.resourceKey,
        metaTitle: dto.metaTitle || defaults.metaTitle,
        metaDescription: dto.metaDescription || defaults.metaDescription,
        ogImageUrl: dto.ogImageUrl ? validateHttpUrl(dto.ogImageUrl, 'La imagen OG') : null,
        canonicalUrl: dto.canonicalUrl
          ? validateHttpUrl(dto.canonicalUrl, 'La URL canonica')
          : null,
        noindex: dto.noindex,
      },
    });
    return this.toResponse(row, resource, dto.resourceType, dto.resourceKey);
  }

  async update(
    id: string,
    locationId: string,
    dto: UpdateSeoMetadataDto,
  ): Promise<SeoMetadataResponseDto> {
    const current = await this.findAdminRow(id, locationId);
    const resource = await this.resolveResource(
      current.resourceType,
      current.resourceKey,
      locationId,
      true,
    );
    const defaults = this.defaultValues(resource, current.resourceType, current.resourceKey);
    const row = await this.seo.update({
      where: { id },
      data: {
        ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle || defaults.metaTitle } : {}),
        ...(dto.metaDescription !== undefined
          ? { metaDescription: dto.metaDescription || defaults.metaDescription }
          : {}),
        ...(dto.ogImageUrl !== undefined
          ? { ogImageUrl: dto.ogImageUrl ? validateHttpUrl(dto.ogImageUrl, 'La imagen OG') : null }
          : {}),
        ...(dto.canonicalUrl !== undefined
          ? {
              canonicalUrl: dto.canonicalUrl
                ? validateHttpUrl(dto.canonicalUrl, 'La URL canonica')
                : null,
            }
          : {}),
        ...(dto.noindex === undefined ? {} : { noindex: dto.noindex }),
      },
    });
    return this.toResponse(row, resource, current.resourceType, current.resourceKey);
  }

  async remove(id: string, locationId: string): Promise<{ deleted: boolean }> {
    const current = await this.findAdminRow(id, locationId);
    const result = await this.seo.deleteMany({ where: { id: current.id } });
    return { deleted: result.count === 1 };
  }

  async getSitemapXml(): Promise<string> {
    const locations = await this.prisma.location.findMany({
      where: { active: true },
      select: { id: true, businessId: true },
      orderBy: { id: 'asc' },
    });
    const firstLocation = locations[0];
    const rows = firstLocation
      ? await this.seo.findMany({
          where: { businessId: firstLocation.businessId, noindex: false },
          orderBy: { updatedAt: 'desc' },
        })
      : [];
    const urls = new Map<string, { loc: string; lastmod?: string }>();

    for (const [key, value] of Object.entries(PAGE_DEFAULTS)) {
      const pageRow = rows.find((row) => row.resourceType === 'page' && row.resourceKey === key);
      if (pageRow?.noindex) continue;
      urls.set(pageRow?.canonicalUrl ?? this.absoluteUrl(value.path), {
        loc: pageRow?.canonicalUrl ?? this.absoluteUrl(value.path),
        ...(pageRow ? { lastmod: pageRow.updatedAt.toISOString() } : {}),
      });
    }

    if (firstLocation) {
      const items = await this.prisma.menuItem.findMany({
        where: {
          active: true,
          publicVisible: true,
          category: { locationId: firstLocation.id, active: true },
          variants: { some: { active: true } },
        },
        select: { slug: true, updatedAt: true },
      });
      for (const item of items) {
        const row = rows.find(
          (candidate) =>
            candidate.resourceType === 'menu_item' && candidate.resourceKey === item.slug,
        );
        if (row?.noindex) continue;
        const loc =
          row?.canonicalUrl ?? this.absoluteUrl(`/carta/${encodeURIComponent(item.slug)}`);
        urls.set(loc, {
          loc,
          lastmod: row?.updatedAt.toISOString() ?? item.updatedAt.toISOString(),
        });
      }
    }

    const [events, announcements] = await Promise.all([
      firstLocation
        ? this.prisma.event.findMany({
            where: {
              locationId: firstLocation.id,
              status: { in: [...PUBLIC_EVENT_STATUSES] as never[] },
            },
            select: { id: true, updatedAt: true },
          })
        : [],
      firstLocation
        ? this.prisma.importantAnnouncement.findMany({
            where: {
              locationId: firstLocation.id,
              active: true,
              OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
              AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
            },
            select: { id: true, updatedAt: true },
          })
        : [],
    ]);

    for (const event of events) {
      const row = rows.find(
        (candidate) => candidate.resourceType === 'event' && candidate.resourceKey === event.id,
      );
      if (row?.noindex) continue;
      const loc = row?.canonicalUrl ?? this.absoluteUrl(`/eventos/${encodeURIComponent(event.id)}`);
      urls.set(loc, {
        loc,
        lastmod: row?.updatedAt.toISOString() ?? event.updatedAt.toISOString(),
      });
    }

    for (const announcement of announcements) {
      const row = rows.find(
        (candidate) =>
          candidate.resourceType === 'announcement' && candidate.resourceKey === announcement.id,
      );
      if (row?.noindex) continue;
      const loc = row?.canonicalUrl ?? this.absoluteUrl('/avisos');
      urls.set(loc, {
        loc,
        lastmod: row?.updatedAt.toISOString() ?? announcement.updatedAt.toISOString(),
      });
    }

    const body = [...urls.values()]
      .map(
        ({ loc, lastmod }) =>
          `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  }

  getRobotsTxt(): string {
    return `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${this.absoluteUrl('/sitemap.xml')}\n`;
  }

  private async findAdminRow(id: string, locationId: string): Promise<SeoRow> {
    const location = await this.getLocation(locationId);
    const row = await this.seo.findFirst({
      where: { id, businessId: location.businessId, OR: [{ locationId: null }, { locationId }] },
    });
    if (!row) throw new NotFoundException('Metadato SEO no encontrado.');
    return row;
  }

  private async findOverride(
    resource: ResolvedResource,
    resourceType: SeoResourceType,
    resourceKey: string,
  ): Promise<SeoRow | null> {
    return this.seo.findFirst({
      where: {
        businessId: resource.businessId,
        resourceType,
        resourceKey,
        ...(resource.storedLocationId
          ? { OR: [{ locationId: resource.storedLocationId }, { locationId: null }] }
          : { locationId: null }),
      },
      orderBy: { locationId: 'asc' },
    });
  }

  private async resolveResource(
    resourceType: SeoResourceType,
    resourceKey: string,
    locationId: string | undefined,
    admin: boolean,
  ): Promise<ResolvedResource> {
    const location = await this.getLocation(locationId);
    const base: LocationContext = {
      ...location,
    };

    if (resourceType === 'page') {
      const page = PAGE_DEFAULTS[resourceKey] ?? {
        title: `${resourceKey} | ${location.tradeName}`,
        description: `Contenido publico de ${location.tradeName}.`,
        path: `/${resourceKey}`,
      };
      return { ...base, ...page, storedLocationId: null };
    }

    if (!locationId) throw new BadRequestException('locationId es obligatorio para este recurso.');

    if (resourceType === 'menu_item') {
      const item = await this.prisma.menuItem.findFirst({
        where: {
          slug: resourceKey,
          active: true,
          publicVisible: true,
          category: { locationId, active: true },
          ...(admin ? {} : { variants: { some: { active: true } } }),
        },
        select: { nameEs: true, descriptionEs: true },
      });
      if (!item) throw new NotFoundException('Plato publicado no encontrado.');
      return {
        ...base,
        title: `${item.nameEs} | ${location.tradeName}`,
        description: item.descriptionEs || `Descubre ${item.nameEs} en ${location.tradeName}.`,
        path: `/carta/${encodeURIComponent(resourceKey)}`,
        storedLocationId: locationId,
      };
    }

    if (resourceType === 'announcement') {
      const announcement = await this.prisma.importantAnnouncement.findFirst({
        where: {
          id: resourceKey,
          locationId,
          ...(admin
            ? { active: true }
            : {
                active: true,
                OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
                AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
              }),
        },
        select: { title: true, message: true },
      });
      if (!announcement) throw new NotFoundException('Aviso publicado no encontrado.');
      return {
        ...base,
        title: `${announcement.title} | ${location.tradeName}`,
        description: announcement.message,
        path: '/avisos',
        storedLocationId: locationId,
      };
    }

    const event = await this.prisma.event.findFirst({
      where: {
        id: resourceKey,
        locationId,
        ...(admin ? {} : { status: { in: [...PUBLIC_EVENT_STATUSES] as never[] } }),
      },
      select: { title: true, specialRequirements: true },
    });
    if (!event) throw new NotFoundException('Evento publicado no encontrado.');
    return {
      ...base,
      title: `${event.title} | ${location.tradeName}`,
      description: event.specialRequirements || `Conoce ${event.title} en ${location.tradeName}.`,
      path: `/eventos/${encodeURIComponent(resourceKey)}`,
      storedLocationId: locationId,
    };
  }

  private async getLocation(locationId?: string): Promise<LocationContext> {
    const row = await this.prisma.location.findFirst({
      where: locationId ? { id: locationId, active: true } : { active: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        businessId: true,
        name: true,
        business: { select: { tradeName: true, siteProfile: { select: { heroImageUrl: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Sede no encontrada.');
    return {
      businessId: row.businessId,
      locationId: row.id,
      tradeName: row.business.tradeName || row.name,
      heroImageUrl: row.business.siteProfile?.heroImageUrl ?? null,
    };
  }

  private defaultValues(resource: ResolvedResource, type: SeoResourceType, key: string) {
    return {
      metaTitle: resource.title.slice(0, 70),
      metaDescription: resource.description.slice(0, 160),
      ogImageUrl: this.safeDefaultImage(resource.heroImageUrl),
      canonicalUrl: this.absoluteUrl(resource.path),
      resourceType: type,
      resourceKey: key,
    };
  }

  private toResponse(
    row: SeoRow | null,
    resource: ResolvedResource,
    type: SeoResourceType,
    key: string,
  ): SeoMetadataResponseDto {
    const defaults = this.defaultValues(resource, type, key);
    return {
      id: row?.id ?? null,
      resourceType: type,
      resourceKey: key,
      metaTitle: row?.metaTitle || defaults.metaTitle,
      metaDescription: row?.metaDescription || defaults.metaDescription,
      ogImageUrl: row?.ogImageUrl || defaults.ogImageUrl,
      canonicalUrl: row?.canonicalUrl || defaults.canonicalUrl,
      noindex: row?.noindex ?? false,
      locationId: row?.locationId ?? resource.storedLocationId,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  private safeDefaultImage(value: string | null): string {
    if (!value) return this.absoluteUrl('/brand/logo-primary.png');
    try {
      return validateHttpUrl(value, 'La imagen OG');
    } catch {
      return this.absoluteUrl('/brand/logo-primary.png');
    }
  }

  private absoluteUrl(path: string): string {
    return new URL(path, `${this.config.publicSiteUrl}/`).toString();
  }
}

export function validateHttpUrl(value: string, label: string): string {
  if (/[\u0000-\u001f\u007f\\]/u.test(value)) {
    throw new BadRequestException(`${label} debe ser una URL HTTP(S) segura.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException(`${label} debe ser una URL HTTP(S) segura.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new BadRequestException(`${label} debe ser una URL HTTP(S) segura.`);
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
