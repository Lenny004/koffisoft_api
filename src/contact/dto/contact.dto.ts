import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { EventType } from '../../generated/prisma/enums.js';
import { ContactMessageStatus } from '../../generated/prisma/enums.js';

const contactTopics = ['general', 'reservation', 'event', 'feedback', 'other'] as const;

/** Recorta espacios en strings antes de validar el DTO. */
function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Normaliza correos a minúsculas y sin espacios laterales. */
function lowerEmail({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/** Normaliza booleanos desde query string o valor nativo antes de validar. */
function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Entrada pública; `website` es un campo honeypot que nunca se persiste. */
export class CreatePublicContactMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  name!: string;

  @ApiProperty({ maxLength: 200 })
  @IsEmail()
  @MaxLength(200)
  @Transform(lowerEmail)
  email!: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  phone?: string;

  @ApiPropertyOptional({ enum: ['es', 'en'], default: 'es' })
  @IsOptional()
  @IsIn(['es', 'en'])
  @Transform(trimValue)
  languageCode = 'es';

  @ApiPropertyOptional({ enum: contactTopics, default: 'general' })
  @IsOptional()
  @IsIn(contactTopics)
  @Transform(trimValue)
  topic: (typeof contactTopics)[number] = 'general';

  @ApiProperty({ minLength: 10, maxLength: 2_000 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2_000)
  @Transform(trimValue)
  message!: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'Honeypot anti-spam; no se persiste.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;
}

/** Filtros de bandeja; todas las consultas quedan delimitadas por sede. */
export class ContactMessageListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10_000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ enum: ContactMessageStatus })
  @IsOptional()
  @IsEnum(ContactMessageStatus)
  status?: ContactMessageStatus;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimValue)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeArchived = false;
}

/** Cambios operativos permitidos en la bandeja. */
export class UpdateContactMessageDto {
  @ApiPropertyOptional({ enum: ContactMessageStatus })
  @IsOptional()
  @IsEnum(ContactMessageStatus)
  status?: ContactMessageStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  archived?: boolean;
}

/** Datos mínimos para convertir un mensaje en una reserva administrativa. */
export class ConvertContactToReservationDto {
  @ApiProperty({ format: 'date', example: '2026-10-24' })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ example: '18:30', pattern: 'HH:mm' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/u)
  @Transform(trimValue)
  time!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  contactPhone!: string;

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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  preferredSpaceId?: string;
}

/** Datos mínimos para convertir un mensaje en una solicitud de evento. */
export class ConvertContactToEventDto {
  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  eventType!: EventType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  title!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ minimum: 1, maximum: 10_000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  estimatedGuestCount!: number;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,2})?$' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\d+(\.\d{1,2})?$/u)
  @Transform(trimValue)
  budgetTarget?: string;
}
