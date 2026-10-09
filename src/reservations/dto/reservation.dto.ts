import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ReservationStatus } from '../../generated/prisma/enums.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Parámetros públicos para consultar mesas disponibles en la sede. */
export class ReservationAvailabilityQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'date', example: '2026-10-24' })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ example: '18:30', pattern: 'HH:mm' })
  @IsString()
  @Matches(TIME_PATTERN)
  time!: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  partySize!: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtra una sede física concreta.' })
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @ApiPropertyOptional({ minimum: 30, maximum: 360, default: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(360)
  durationMinutes = 120;
}

/** Solicitud pública de reserva; siempre se persiste como `requested`. */
export class CreatePublicReservationDto extends ReservationAvailabilityQueryDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  contactName!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  contactPhone!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimValue)
  contactEmail?: string;

  @ApiPropertyOptional({ enum: ['es', 'en'], default: 'es' })
  @IsOptional()
  @IsString()
  @Matches(/^(es|en)$/u)
  preferredLanguage = 'es';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  preferredSpaceId?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  specialRequests?: string;
}

/** Datos para crear desde el panel una reserva con origen administrativo. */
export class CreateAdminReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'date', example: '2026-10-24' })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ example: '18:30', pattern: 'HH:mm' })
  @IsString()
  @Matches(TIME_PATTERN)
  time!: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  partySize!: number;

  @ApiPropertyOptional({ minimum: 30, maximum: 360, default: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(360)
  durationMinutes = 120;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Cliente existente; sus datos completan los snapshots faltantes.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimValue)
  contactName?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  contactPhone?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimValue)
  contactEmail?: string;

  @ApiPropertyOptional({ enum: ['es', 'en'], default: 'es' })
  @IsOptional()
  @IsString()
  @Matches(/^(es|en)$/u)
  preferredLanguage?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  preferredSpaceId?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  internalNotes?: string;

  @ApiPropertyOptional({
    enum: [ReservationStatus.PendingConfirmation, ReservationStatus.Confirmed],
  })
  @IsOptional()
  @IsEnum(ReservationStatus)
  @IsIn([ReservationStatus.PendingConfirmation, ReservationStatus.Confirmed])
  status: ReservationStatus = ReservationStatus.PendingConfirmation;

  @ApiPropertyOptional({ type: () => [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tableIds: string[] = [];
}

/** Filtros de listados administrativos con fechas ISO explícitas. */
export class ReservationListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

/** Filtros administrativos del catálogo físico. */
export class VenueListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeInactive = false;
}

export class DiningTableListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

/** Datos de un espacio de la sede. */
export class CreateVenueSpaceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  code!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  nameEs!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  nameEn!: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @IsIn(['indoor', 'terrace', 'viewpoint', 'private_room', 'garden', 'other'])
  @MaxLength(30)
  @Transform(trimValue)
  spaceType!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatedCapacity!: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  standingCapacity?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsTableReservation = true;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsPrivateEvent = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos editables sin cambiar la sede de un espacio. */
export class UpdateVenueSpaceDto {
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  code?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  nameEs?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  nameEn?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(trimValue)
  spaceType?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatedCapacity?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  standingCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowsTableReservation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowsPrivateEvent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Datos de una mesa física dentro de un espacio. */
export class CreateDiningTableDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  spaceId!: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(trimValue)
  tableCode!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trimValue)
  name!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCount!: number;

  @ApiPropertyOptional({ maxLength: 20, default: 'round' })
  @IsOptional()
  @IsString()
  @IsIn(['round', 'square', 'rectangular', 'communal'])
  @MaxLength(20)
  @Transform(trimValue)
  shape = 'round';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos editables de una mesa. */
export class UpdateDiningTableDto {
  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(trimValue)
  tableCode?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trimValue)
  name?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCount?: number;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @IsIn(['round', 'square', 'rectangular', 'communal'])
  @MaxLength(20)
  @Transform(trimValue)
  shape?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Reemplaza las mesas asignadas; la operación libera las anteriores en la misma transacción. */
export class AssignReservationTablesDto {
  @ApiProperty({ type: () => [String], format: 'uuid' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  tableIds!: string[];
}
