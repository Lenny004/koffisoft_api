import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  EventQuoteLineType,
  EventSpaceBookingStatus,
  EventStatus,
  EventType,
  QuoteStatus,
} from '../../generated/prisma/enums.js';

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function decimalValue({ value }: { value: unknown }): unknown {
  return typeof value === 'number' ? String(value) : value;
}

function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Parámetros públicos para listar paquetes de eventos visibles. */
export class PublicEventCatalogQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
}

/** Solicitud pública que abre un evento en estado `inquiry`. */
export class CreatePublicEventRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  eventType!: EventType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  title!: string;

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
  @Transform(trimValue)
  preferredLanguage = 'es';

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  setupStartsAt?: string;

  @ApiProperty({ minimum: 1, maximum: 10_000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedGuestCount!: number;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @IsOptional()
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  budgetTarget?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  specialRequirements?: string;
}

/** Listado administrativo paginado de eventos. */
export class EventListQueryDto {
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

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}

export class EventPackageListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeInactive = false;
}

/** Creación administrativa de un evento. */
export class CreateEventDto extends CreatePublicEventRequestDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trimValue)
  eventCode?: string;

  @ApiPropertyOptional({ maxLength: 30, default: 'admin' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  source = 'admin';

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.Inquiry })
  @IsOptional()
  @IsEnum(EventStatus)
  status = EventStatus.Inquiry;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  confirmedGuestCount?: number;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  internalNotes?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  coordinatorUserId?: string;
}

/** Campos administrativos editables de un evento. */
export class UpdateEventDto {
  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  setupStartsAt?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedGuestCount?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  confirmedGuestCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  budgetTarget?: string;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  specialRequirements?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  internalNotes?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  coordinatorUserId?: string;
}

/** Reserva temporal de un espacio, con bloqueo opcional de montaje y desmontaje. */
export class CreateEventSpaceBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  venueSpaceId!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  setupStartsAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  teardownEndsAt?: string;

  @ApiPropertyOptional({ enum: EventSpaceBookingStatus, default: EventSpaceBookingStatus.Held })
  @IsOptional()
  @IsEnum(EventSpaceBookingStatus)
  bookingStatus = EventSpaceBookingStatus.Held;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacityReserved!: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  holdExpiresAt?: string;
}

/** Línea reutilizable de un paquete de eventos. */
export class EventPackageLineDto {
  @ApiProperty({ enum: EventQuoteLineType })
  @IsEnum(EventQuoteLineType)
  lineType!: EventQuoteLineType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  menuItemVariantId?: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  labelEs!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  labelEn!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,6})?$/u)
  quantity!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  unit!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  unitPrice!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Paquete administrable y sus líneas en una escritura transaccional. */
export class CreateEventPackageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trimValue)
  packageCode!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  nameEs!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  descriptionEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  descriptionEn?: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @IsIn(['per_person', 'flat', 'hourly'])
  @MaxLength(20)
  pricingModel!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  basePrice!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minGuestCount?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxGuestCount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;

  @ApiPropertyOptional({ type: () => [EventPackageLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventPackageLineDto)
  lines?: EventPackageLineDto[];
}

export class UpdateEventPackageDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trimValue)
  packageCode?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  nameEs?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  descriptionEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  descriptionEn?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(trimValue)
  pricingModel?: string;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @IsOptional()
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  basePrice?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minGuestCount?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxGuestCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: () => [EventPackageLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventPackageLineDto)
  lines?: EventPackageLineDto[];
}

/** Línea congelada de una cotización; sus importes de salida los calcula la API. */
export class EventQuoteLineDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eventPackageLineId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  menuItemVariantId?: string;

  @ApiProperty({ enum: EventQuoteLineType })
  @IsEnum(EventQuoteLineType)
  lineType!: EventQuoteLineType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  labelEs!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  labelEn!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,6})?$/u)
  quantity!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  unit!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  unitPrice!: string;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @IsOptional()
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/u)
  discountAmount = '0';

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,6})?$', default: '0' })
  @IsOptional()
  @Transform(decimalValue)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,6})?$/u)
  taxRate = '0';

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder = 0;
}

/** Cotización versionada; los totales persistidos no se aceptan desde el cliente. */
export class CreateEventQuoteDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eventPackageId?: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  validUntil!: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  termsEs?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  termsEn?: string;

  @ApiProperty({ type: () => [EventQuoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EventQuoteLineDto)
  lines!: EventQuoteLineDto[];
}

export class UpdateEventQuoteStatusDto {
  @ApiProperty({ enum: QuoteStatus })
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;
}

/** Requisito operativo de un evento. */
export class CreateEventRequirementDto {
  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @IsIn(['allergy', 'diet', 'accessibility', 'equipment', 'schedule', 'other'])
  @MaxLength(30)
  @Transform(trimValue)
  requirementType!: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  description!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ maxLength: 20, default: 'important' })
  @IsOptional()
  @IsString()
  @IsIn(['informational', 'important', 'critical'])
  @MaxLength(20)
  @Transform(trimValue)
  severity = 'important';

  @ApiPropertyOptional({ maxLength: 20, default: 'open' })
  @IsOptional()
  @IsString()
  @IsIn(['open', 'acknowledged', 'resolved'])
  @MaxLength(20)
  @Transform(trimValue)
  status = 'open';
}

export class UpdateEventRequirementDto {
  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  description?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @IsIn(['informational', 'important', 'critical'])
  @MaxLength(20)
  @Transform(trimValue)
  severity?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @IsIn(['open', 'acknowledged', 'resolved'])
  @MaxLength(20)
  @Transform(trimValue)
  status?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;
}
