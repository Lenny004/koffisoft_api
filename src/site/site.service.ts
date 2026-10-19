import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { RequestMetadata } from '../auth/auth.types.js';
import type {
  SiteHourDto,
  SiteHourOverrideDto,
  SiteProfileDto,
  UpdateSiteContentDto,
} from './dto/site.dto.js';
import type {
  SiteContentResponseDto,
  SiteHourOverrideResponseDto,
  SiteHourResponseDto,
  SiteProfileResponseDto,
  SiteTeamMemberResponseDto,
} from './dto/site-response.dto.js';

const siteInclude = {
  business: { select: { siteProfile: true } },
  locationHours: {
    orderBy: [{ serviceType: 'asc' }, { dayOfWeek: 'asc' }, { opensAt: 'asc' }],
  },
  hourOverrides: {
    orderBy: [{ serviceDate: 'asc' }, { serviceType: 'asc' }],
  },
} as const satisfies Prisma.LocationInclude;

type SiteRow = Prisma.LocationGetPayload<{ include: typeof siteInclude }>;

/** Coordina el contenido público y la edición transaccional por sede. */
@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve perfil, horarios y excepciones publicables de una sede activa.
   */
  async getSite(locationId: string): Promise<SiteContentResponseDto> {
    const row = await this.requireLocation(locationId);
    return this.toResponse(row);
  }

  async updateSite(
    locationId: string,
    dto: UpdateSiteContentDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<SiteContentResponseDto> {
    this.validateHours(dto.hours);
    this.validateOverrides(dto.overrides);
    const current = await this.requireLocation(locationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id: locationId },
        data: {
          addressLine: dto.location.addressLine,
          municipality: dto.location.municipality,
          department: dto.location.department,
          phone: dto.location.phone ?? null,
          email: dto.location.email ?? null,
          latitude: dto.location.latitude ?? null,
          longitude: dto.location.longitude ?? null,
        },
      });

      await tx.locationHour.deleteMany({ where: { locationId } });
      if (dto.hours.length > 0) {
        await tx.locationHour.createMany({
          data: dto.hours.map((hour) => ({
            locationId,
            serviceType: hour.serviceType,
            dayOfWeek: hour.dayOfWeek,
            opensAt: timeOnly(hour.opensAt),
            closesAt: timeOnly(hour.closesAt),
            crossesMidnight: hour.crossesMidnight,
            active: hour.active,
          })),
        });
      }

      await tx.locationHourOverride.deleteMany({ where: { locationId } });
      if (dto.overrides.length > 0) {
        await tx.locationHourOverride.createMany({
          data: dto.overrides.map((override) => ({
            locationId,
            serviceDate: dateOnly(override.serviceDate),
            serviceType: override.serviceType,
            opensAt: override.opensAt ? timeOnly(override.opensAt) : null,
            closesAt: override.closesAt ? timeOnly(override.closesAt) : null,
            isClosed: override.isClosed,
            reason: override.reason,
          })),
        });
      }

      await tx.businessSiteProfile.upsert({
        where: { businessId: current.businessId },
        create: {
          businessId: current.businessId,
          ...this.profileData(dto.profile),
        },
        update: this.profileData(dto.profile),
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'site_content.updated',
          entityType: 'location',
          entityId: locationId,
          beforeData: this.auditValue(this.toAuditData(current)),
          afterData: this.auditValue({ locationId, ...dto }),
          requestId: metadata.requestId,
          ipAddress: metadata.ipAddress,
        },
      });
    });

    return this.getSite(locationId);
  }

  private async requireLocation(locationId: string): Promise<SiteRow> {
    const row = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: siteInclude,
    });
    if (!row || !row.active) throw new NotFoundException('Sede no encontrada.');
    return row;
  }

  private validateHours(hours: SiteHourDto[]): void {
    const keys = new Set<string>();
    for (const hour of hours) {
      const key = `${hour.serviceType}:${hour.dayOfWeek}:${hour.opensAt}`;
      if (keys.has(key)) throw new BadRequestException('No puede repetir un horario.');
      keys.add(key);
      this.validateTimeWindow(hour.opensAt, hour.closesAt, hour.crossesMidnight);
    }
  }

  private validateOverrides(overrides: SiteHourOverrideDto[]): void {
    const keys = new Set<string>();
    for (const override of overrides) {
      const key = `${override.serviceDate}:${override.serviceType}`;
      if (keys.has(key))
        throw new BadRequestException('No puede repetir una excepción de horario.');
      keys.add(key);
      if (override.isClosed) {
        if (override.opensAt || override.closesAt) {
          throw new BadRequestException('Una sede cerrada no puede tener horas de apertura.');
        }
        continue;
      }
      if (!override.opensAt || !override.closesAt) {
        throw new BadRequestException('Una excepción abierta requiere hora inicial y final.');
      }
      this.validateTimeWindow(override.opensAt, override.closesAt, false);
    }
  }

  private validateTimeWindow(opensAt: string, closesAt: string, crossesMidnight: boolean): void {
    const opens = timeMinutes(opensAt);
    const closes = timeMinutes(closesAt);
    if (opens === closes || (!crossesMidnight && closes <= opens)) {
      throw new BadRequestException('La hora final debe ser posterior a la inicial.');
    }
  }

  private profileData(
    profile: SiteProfileDto,
  ): Omit<
    Prisma.BusinessSiteProfileUncheckedCreateInput,
    'id' | 'businessId' | 'createdAt' | 'updatedAt'
  > {
    return {
      heroEyebrow: profile.heroEyebrow,
      heroTitle: profile.heroTitle,
      heroDescription: profile.heroDescription,
      heroImageUrl: profile.heroImageUrl ?? null,
      aboutTitle: profile.aboutTitle,
      aboutDescription: profile.aboutDescription,
      aboutMission: profile.aboutMission,
      aboutVision: profile.aboutVision,
      aboutTeam: profile.aboutTeam as unknown as Prisma.InputJsonValue,
      socialFacebookUrl: profile.socialFacebookUrl ?? null,
      socialInstagramUrl: profile.socialInstagramUrl ?? null,
      socialTikTokUrl: profile.socialTikTokUrl ?? null,
    };
  }

  private toResponse(row: SiteRow): SiteContentResponseDto {
    const profile = row.business.siteProfile;
    return {
      locationId: row.id,
      location: {
        id: row.id,
        businessId: row.businessId,
        name: row.name,
        addressLine: row.addressLine,
        municipality: row.municipality,
        department: row.department,
        phone: row.phone,
        email: row.email,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        timezone: row.timezone,
      },
      hours: row.locationHours.map((hour) => this.toHourResponse(hour)),
      overrides: row.hourOverrides.map((override) => this.toOverrideResponse(override)),
      profile: profile ? this.toProfileResponse(profile) : null,
    };
  }

  private toHourResponse(row: SiteRow['locationHours'][number]): SiteHourResponseDto {
    return {
      id: row.id,
      serviceType: row.serviceType,
      dayOfWeek: row.dayOfWeek,
      opensAt: formatTime(row.opensAt),
      closesAt: formatTime(row.closesAt),
      crossesMidnight: row.crossesMidnight,
      active: row.active,
    };
  }

  private toOverrideResponse(row: SiteRow['hourOverrides'][number]): SiteHourOverrideResponseDto {
    return {
      id: row.id,
      serviceDate: row.serviceDate.toISOString().slice(0, 10),
      serviceType: row.serviceType,
      opensAt: row.opensAt ? formatTime(row.opensAt) : null,
      closesAt: row.closesAt ? formatTime(row.closesAt) : null,
      isClosed: row.isClosed,
      reason: row.reason,
    };
  }

  private toProfileResponse(
    row: NonNullable<SiteRow['business']['siteProfile']>,
  ): SiteProfileResponseDto {
    return {
      id: row.id,
      businessId: row.businessId,
      heroEyebrow: row.heroEyebrow,
      heroTitle: row.heroTitle,
      heroDescription: row.heroDescription,
      heroImageUrl: row.heroImageUrl,
      aboutTitle: row.aboutTitle,
      aboutDescription: row.aboutDescription,
      aboutMission: row.aboutMission,
      aboutVision: row.aboutVision,
      aboutTeam: normalizeTeam(row.aboutTeam),
      socialFacebookUrl: row.socialFacebookUrl,
      socialInstagramUrl: row.socialInstagramUrl,
      socialTikTokUrl: row.socialTikTokUrl,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAuditData(row: SiteRow): Record<string, unknown> {
    return {
      locationId: row.id,
      addressLine: row.addressLine,
      municipality: row.municipality,
      department: row.department,
      phone: row.phone,
      email: row.email,
      hours: row.locationHours.map((hour) => this.toHourResponse(hour)),
      overrides: row.hourOverrides.map((override) => this.toOverrideResponse(override)),
      profile: row.business.siteProfile ? this.toProfileResponse(row.business.siteProfile) : null,
    };
  }

  private auditValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}

/**
 * Convierte HH:mm a Date UTC usado solo como contenedor de hora.
 */
function timeOnly(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours ?? 0, minutes ?? 0));
}

/**
 * Formatea una hora almacenada como Date UTC a cadena HH:mm.
 */
function formatTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Convierte HH:mm a minutos desde medianoche para comparar ventanas.
 */
function timeMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Parsea una fecha calendario ISO sin componente horario en UTC.
 */
function dateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Filtra miembros del equipo con forma válida desde JSON almacenado en perfil.
 */
function normalizeTeam(value: Prisma.JsonValue): SiteTeamMemberResponseDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((member) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) return [];
    const candidate = member as Record<string, unknown>;
    if (
      typeof candidate.name !== 'string' ||
      typeof candidate.role !== 'string' ||
      typeof candidate.description !== 'string'
    ) {
      return [];
    }
    return [
      {
        name: candidate.name,
        role: candidate.role,
        description: candidate.description,
      },
    ];
  });
}
