import { createHash } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import {
  ANALYTICS_RESOURCE_TYPES,
  type AnalyticsResourceType,
  type AnalyticsRangeQueryDto,
  type CreatePageViewDto,
} from './dto/analytics.dto.js';
import type {
  AnalyticsDailyPointDto,
  AnalyticsLocationResponseDto,
  AnalyticsPageResponseDto,
  AnalyticsProductResponseDto,
  AnalyticsReferrerResponseDto,
  AnalyticsSummaryResponseDto,
} from './dto/analytics-response.dto.js';

const RETENTION_DAYS = 395;
const MAX_REPORT_DAYS = 366;
const RETENTION_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const BOT_PATTERN = /(bot|crawler|spider|slurp|headless|preview|facebookexternalhit|bingpreview)/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DEFAULT_TIMEZONE = 'America/El_Salvador';

interface LocationContext {
  id: string;
  businessId: string;
  timezone: string;
}

interface NormalizedPageView {
  path: string;
  locationId: string | null;
  resourceType: AnalyticsResourceType;
  resourceKey: string | null;
  refererHost: string | null;
  userAgentFamily: string | null;
  occurredAt: Date;
  aggregateKey: string;
}

interface DateRange {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
}

/** Coordina la normalización, agregación diaria y consultas de analíticas. */
@Injectable()
export class AnalyticsService {
  private lastRetentionRunAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async recordPageView(
    dto: CreatePageViewDto,
    userAgent: string | string[] | undefined,
  ): Promise<void> {
    const normalized = this.normalizePageView(dto, userAgent);
    if (!normalized) return;

    const context = await this.resolvePublicLocation(dto.locationId);
    if (!context) return;

    const event = {
      ...normalized,
      locationId: context.id,
      occurredAt: dateAtUtc(dateKey(new Date(), context.timezone)) ?? normalized.occurredAt,
    };
    const aggregateKey = this.aggregateKey(context.businessId, event);
    const completeEvent: NormalizedPageView = { ...event, aggregateKey };

    await this.pruneExpired(completeEvent.occurredAt);
    await this.prisma.pageView.upsert({
      where: { aggregateKey },
      create: {
        businessId: context.businessId,
        locationId: completeEvent.locationId,
        path: completeEvent.path,
        resourceType: completeEvent.resourceType,
        resourceKey: completeEvent.resourceKey,
        refererHost: completeEvent.refererHost,
        occurredAt: completeEvent.occurredAt,
        userAgentFamily: completeEvent.userAgentFamily,
        aggregateKey,
        viewCount: 1,
      },
      update: { viewCount: { increment: 1 } },
    });
  }

  /**
   * Lista sedes activas de los negocios autorizados para el usuario analítico.
   */
  async listLocations(actorUserId: string): Promise<AnalyticsLocationResponseDto[]> {
    const businessIds = await this.authorizedBusinessIds(actorUserId);
    if (!businessIds.length) return [];

    return this.prisma.location.findMany({
      where: { businessId: { in: businessIds }, active: true },
      select: { id: true, code: true, name: true, timezone: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * Agrega visitas diarias en un rango acotado y devuelve totales.
   */
  async getSummary(query: AnalyticsRangeQueryDto): Promise<AnalyticsSummaryResponseDto> {
    const range = await this.resolveReportRange(query);
    const rows = await this.prisma.pageView.groupBy({
      by: ['occurredAt'],
      where: this.rangeWhere(query.locationId, range),
      _sum: { viewCount: true },
      orderBy: { occurredAt: 'asc' },
    });
    const visitsByDate = new Map(
      rows.map((row) => [this.dateKey(row.occurredAt), row._sum.viewCount ?? 0]),
    );
    const daily = this.listDateKeys(range.fromKey, range.toKey).map(
      (date): AnalyticsDailyPointDto => ({ date, visits: visitsByDate.get(date) ?? 0 }),
    );

    return { totalVisits: daily.reduce((total, point) => total + point.visits, 0), daily };
  }

  /**
   * Ranking de rutas más visitadas en el rango solicitado.
   */
  async getPages(query: AnalyticsRangeQueryDto): Promise<AnalyticsPageResponseDto[]> {
    const range = await this.resolveReportRange(query);
    const rows = await this.prisma.pageView.groupBy({
      by: ['path'],
      where: { ...this.rangeWhere(query.locationId, range), resourceType: 'page' },
      _sum: { viewCount: true },
      orderBy: { _sum: { viewCount: 'desc' } },
      take: 100,
    });

    return rows.map((row) => ({ path: row.path, visits: row._sum.viewCount ?? 0 }));
  }

  /**
   * Ranking de ítems de menú y eventos más vistos en el rango.
   */
  async getProducts(query: AnalyticsRangeQueryDto): Promise<AnalyticsProductResponseDto[]> {
    const range = await this.resolveReportRange(query);
    const rows = await this.prisma.pageView.groupBy({
      by: ['resourceType', 'resourceKey'],
      where: {
        ...this.rangeWhere(query.locationId, range),
        resourceType: { in: ['menu_item', 'event'] },
      },
      _sum: { viewCount: true },
      orderBy: { _sum: { viewCount: 'desc' } },
      take: 100,
    });

    return rows.map((row) => ({
      resourceType: row.resourceType,
      resourceKey: row.resourceKey ?? 'Sin identificar',
      visits: row._sum.viewCount ?? 0,
    }));
  }

  /**
   * Ranking de hosts referentes o tráfico directo en el rango.
   */
  async getReferrers(query: AnalyticsRangeQueryDto): Promise<AnalyticsReferrerResponseDto[]> {
    const range = await this.resolveReportRange(query);
    const rows = await this.prisma.pageView.groupBy({
      by: ['refererHost'],
      where: this.rangeWhere(query.locationId, range),
      _sum: { viewCount: true },
      orderBy: { _sum: { viewCount: 'desc' } },
      take: 100,
    });

    return rows.map((row) => ({
      host: row.refererHost ?? 'Directo',
      visits: row._sum.viewCount ?? 0,
    }));
  }

  private normalizePageView(
    dto: CreatePageViewDto,
    userAgent: string | string[] | undefined,
    now = new Date(),
  ): Omit<NormalizedPageView, 'aggregateKey' | 'locationId'> | null {
    const rawUserAgent = Array.isArray(userAgent) ? userAgent[0] : userAgent;
    if (dto.isPreview || isPreviewPath(dto.path) || isBotUserAgent(rawUserAgent)) return null;

    const path = normalizePath(dto.path);
    if (!path) return null;

    const resourceType = dto.resourceType ?? 'page';
    if (!ANALYTICS_RESOURCE_TYPES.includes(resourceType)) return null;

    const occurredAt = dateAtUtc(dateKey(now, DEFAULT_TIMEZONE));
    if (!occurredAt) return null;

    return {
      path,
      resourceType,
      resourceKey: normalizeOptional(dto.resourceKey),
      refererHost: normalizeRefererHost(dto.referer),
      userAgentFamily: classifyUserAgent(rawUserAgent),
      occurredAt,
    };
  }

  private async resolvePublicLocation(locationId?: string): Promise<LocationContext | null> {
    return this.prisma.location.findFirst({
      where: locationId ? { id: locationId, active: true } : { active: true },
      select: { id: true, businessId: true, timezone: true },
      orderBy: locationId ? undefined : { createdAt: 'asc' },
    });
  }

  private async resolveReportRange(query: AnalyticsRangeQueryDto): Promise<DateRange> {
    const location = await this.prisma.location.findFirst({
      where: { id: query.locationId, active: true },
      select: { timezone: true },
    });
    const timezone = location?.timezone ?? DEFAULT_TIMEZONE;
    const today = dateKey(new Date(), timezone);
    const toKey = query.to ?? today;
    const fromKey = query.from ?? shiftDateKey(toKey, -(MAX_REPORT_DAYS - 1));
    const from = dateAtUtc(fromKey);
    const to = dateAtUtc(toKey);

    if (!from || !to || from > to)
      throw new BadRequestException('El rango de fechas no es válido.');
    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days > MAX_REPORT_DAYS) {
      throw new BadRequestException(`El rango no puede superar ${MAX_REPORT_DAYS} días.`);
    }

    return { from, to, fromKey, toKey };
  }

  private rangeWhere(locationId: string, range: DateRange) {
    return { locationId, occurredAt: { gte: range.from, lte: range.to } };
  }

  private async authorizedBusinessIds(actorUserId: string): Promise<string[]> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        roles: {
          where: { active: true, role: { active: true } },
          select: { role: { select: { businessId: true } } },
        },
      },
    });
    return [...new Set(actor?.roles.map(({ role }) => role.businessId) ?? [])];
  }

  private async pruneExpired(occurredAt: Date): Promise<void> {
    if (Date.now() - this.lastRetentionRunAt < RETENTION_CHECK_INTERVAL_MS) return;
    const cutoff = new Date(occurredAt);
    cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
    await this.prisma.pageView.deleteMany({ where: { occurredAt: { lt: cutoff } } });
    this.lastRetentionRunAt = Date.now();
  }

  private aggregateKey(
    businessId: string,
    event: Omit<NormalizedPageView, 'aggregateKey'>,
  ): string {
    return createHash('sha256')
      .update(
        [
          businessId,
          event.locationId ?? '',
          event.occurredAt.toISOString(),
          event.path,
          event.resourceType,
          event.resourceKey ?? '',
          event.refererHost ?? '',
          event.userAgentFamily ?? '',
        ].join('\u001f'),
      )
      .digest('hex');
  }

  private dateKey(value: Date): string {
    return dateKey(value, 'UTC');
  }

  private listDateKeys(from: string, to: string): string[] {
    const dates: string[] = [];
    const first = dateAtUtc(from);
    const last = dateAtUtc(to);
    if (!first || !last) return dates;

    for (let current = first; current <= last; current = addDays(current, 1)) {
      dates.push(this.dateKey(current));
    }
    return dates;
  }
}

/**
 * Detecta user-agents de bots para excluirlos del conteo.
 */
export function isBotUserAgent(userAgent: string | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/**
 * Indica si la ruta pertenece al modo vista previa.
 */
export function isPreviewPath(path: string): boolean {
  return /^\/preview(?:\/|$)/u.test(path.trim());
}

/**
 * Normaliza y valida rutas internas antes de persistir page views.
 */
export function normalizePath(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.length > 500 || !candidate.startsWith('/')) return null;

  try {
    const parsed = new URL(candidate, 'https://analytics.invalid');
    if (parsed.origin !== 'https://analytics.invalid') return null;
    const path = parsed.pathname.replace(/\/+/gu, '/').replace(/\/$/u, '') || '/';
    return path.length <= 500 ? path : null;
  } catch {
    return null;
  }
}

/**
 * Extrae el hostname de un referer HTTP(S) o devuelve null.
 */
export function normalizeRefererHost(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.hostname.toLowerCase().replace(/\.$/u, '') || null;
  } catch {
    return null;
  }
}

/**
 * Convierte strings opcionales en null si quedan vacíos tras trim.
 */
function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Agrupa el user-agent en familias conocidas para reportes.
 */
function classifyUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  if (/edg\//iu.test(userAgent)) return 'Edge';
  if (/opr\//iu.test(userAgent)) return 'Opera';
  if (/chrome\//iu.test(userAgent)) return 'Chrome';
  if (/firefox\//iu.test(userAgent)) return 'Firefox';
  if (/safari\//iu.test(userAgent)) return 'Safari';
  return 'Otro';
}

/**
 * Formatea una fecha calendario en la zona horaria indicada.
 */
function dateKey(value: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

/**
 * Parsea YYYY-MM-DD a medianoche UTC o null si es inválida.
 */
function dateAtUtc(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/**
 * Desplaza una clave de fecha calendario N días en UTC.
 */
function shiftDateKey(value: string, days: number): string {
  const date = dateAtUtc(value) ?? new Date();
  return dateKey(addDays(date, days), 'UTC');
}

/**
 * Suma días calendario en UTC sobre una fecha base.
 */
function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
