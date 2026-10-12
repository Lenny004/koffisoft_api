import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type {
  AnnouncementListQueryDto,
  CreateAnnouncementDto,
  PublicAnnouncementQueryDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';
import type { AnnouncementResponseDto } from './dto/announcement-response.dto.js';

/** Coordina la vigencia editorial y el CRUD de avisos por sede. */
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: PublicAnnouncementQueryDto): Promise<AnnouncementResponseDto[]> {
    const now = new Date();
    const rows = await this.prisma.importantAnnouncement.findMany({
      where: {
        locationId: query.locationId,
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async listAdmin(query: AnnouncementListQueryDto): Promise<AnnouncementResponseDto[]> {
    const rows = await this.prisma.importantAnnouncement.findMany({
      where: { locationId: query.locationId, ...(query.includeInactive ? {} : { active: true }) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async create(dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    this.validateDates(dto.startsAt, dto.endsAt);
    await this.requireLocation(dto.locationId);
    const row = await this.prisma.importantAnnouncement.create({
      data: {
        locationId: dto.locationId,
        title: dto.title,
        message: dto.message,
        ctaLabel: dto.ctaLabel || null,
        ctaUrl: dto.ctaUrl || null,
        startsAt: this.toDate(dto.startsAt),
        endsAt: this.toDate(dto.endsAt),
        displayOrder: dto.displayOrder,
        active: dto.active,
      },
    });
    return this.toResponse(row);
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<AnnouncementResponseDto> {
    const current = await this.prisma.importantAnnouncement.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Aviso importante no encontrado.');
    const startsAt = dto.startsAt === undefined ? current.startsAt : this.toDate(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? current.endsAt : this.toDate(dto.endsAt);
    this.validateDates(startsAt?.toISOString(), endsAt?.toISOString());
    const row = await this.prisma.importantAnnouncement.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.message === undefined ? {} : { message: dto.message }),
        ...(dto.ctaLabel === undefined ? {} : { ctaLabel: dto.ctaLabel || null }),
        ...(dto.ctaUrl === undefined ? {} : { ctaUrl: dto.ctaUrl || null }),
        ...(dto.startsAt === undefined ? {} : { startsAt }),
        ...(dto.endsAt === undefined ? {} : { endsAt }),
        ...(dto.displayOrder === undefined ? {} : { displayOrder: dto.displayOrder }),
        ...(dto.active === undefined ? {} : { active: dto.active }),
      },
    });
    return this.toResponse(row);
  }

  async remove(id: string): Promise<AnnouncementResponseDto> {
    const row = await this.prisma.importantAnnouncement.update({
      where: { id },
      data: { active: false },
    });
    return this.toResponse(row);
  }

  private async requireLocation(id: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id, active: true },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private validateDates(startsAt?: string | null, endsAt?: string | null): void {
    if (!startsAt || !endsAt) return;
    const starts = new Date(startsAt);
    const ends = new Date(endsAt);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      throw new BadRequestException('La fecha final debe ser posterior a la fecha inicial.');
    }
  }

  private toDate(value?: string | null): Date | null {
    if (value === undefined || value === null || value === '') return null;
    return new Date(value);
  }

  private toResponse(row: {
    id: string;
    locationId: string;
    title: string;
    message: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    displayOrder: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AnnouncementResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      title: row.title,
      message: row.message,
      ctaLabel: row.ctaLabel,
      ctaUrl: row.ctaUrl,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      displayOrder: row.displayOrder,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
