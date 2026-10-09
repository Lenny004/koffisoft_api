import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuChannel } from '../../generated/prisma/enums.js';
import { AdminListQueryDto } from './menu-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

/** Ventana semanal y opcionalmente estacional de disponibilidad. */
export class CreateMenuAvailabilityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ enum: MenuChannel, example: MenuChannel.Web })
  @IsEnum(MenuChannel)
  channel!: MenuChannel;

  @ApiProperty({ minimum: 1, maximum: 7, description: 'ISO: lunes=1 ... domingo=7.' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: '07:30', pattern: 'HH:mm' })
  @IsString()
  @Matches(TIME_PATTERN)
  startsAt!: string;

  @ApiProperty({ example: '11:00', pattern: 'HH:mm' })
  @IsString()
  @Matches(TIME_PATTERN)
  endsAt!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  crossesMidnight = false;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos modificables de una ventana de disponibilidad. */
export class UpdateMenuAvailabilityDto {
  @ApiPropertyOptional({ enum: MenuChannel })
  @IsOptional()
  @IsEnum(MenuChannel)
  channel?: MenuChannel;

  @ApiPropertyOptional({ minimum: 1, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ pattern: 'HH:mm' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  startsAt?: string;

  @ApiPropertyOptional({ pattern: 'HH:mm' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  crossesMidnight?: boolean;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MenuAvailabilityListQueryDto extends AdminListQueryDto {}

/** Agotado temporal que prevalece sobre la ventana horaria. */
export class CreateMenuItemOutageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  reason!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

export class UpdateMenuItemOutageDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MenuOutageListQueryDto extends AdminListQueryDto {}
