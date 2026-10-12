import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Filtros para consultar los avisos visibles de una sede. */
export class PublicAnnouncementQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
}

/** Filtros del listado administrativo, que puede incluir avisos inactivos. */
export class AnnouncementListQueryDto extends PublicAnnouncementQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeInactive = false;
}

/** Datos editoriales compartidos por la creación y actualización administrativa. */
export class CreateAnnouncementDto extends PublicAnnouncementQueryDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  title!: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  message!: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimValue)
  ctaLabel?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  ctaUrl?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  displayOrder = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active = true;
}

/** Campos que el panel puede modificar sin cambiar la sede del aviso. */
export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  title?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  message?: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimValue)
  ctaLabel?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  ctaUrl?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active?: boolean;
}
