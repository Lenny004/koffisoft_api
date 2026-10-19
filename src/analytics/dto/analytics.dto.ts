import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ANALYTICS_RESOURCE_TYPES = ['page', 'menu_item', 'event', 'announcement'] as const;
export type AnalyticsResourceType = (typeof ANALYTICS_RESOURCE_TYPES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Recorta espacios en strings antes de validar el DTO.
 */
function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Normaliza booleanos desde query string o valor nativo antes de validar.
 */
function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Datos mínimos de una visita; el cliente nunca envía IP ni cookies. */
export class CreatePageViewDto {
  @ApiProperty({ example: '/carta/cafe-de-la-casa', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  path!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ enum: ANALYTICS_RESOURCE_TYPES, default: 'page' })
  @IsOptional()
  @IsIn(ANALYTICS_RESOURCE_TYPES)
  resourceType: AnalyticsResourceType = 'page';

  @ApiPropertyOptional({ maxLength: 160, example: 'cafe-de-la-casa' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(trimValue)
  resourceKey?: string;

  @ApiPropertyOptional({ maxLength: 2048, example: 'https://buscador.example/resultados' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  referer?: string;

  @ApiPropertyOptional({ default: false, description: 'Marca una vista previa no contabilizable.' })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isPreview = false;
}

/** Filtros de reportes por sede y día calendario local. */
export class AnalyticsRangeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-01' })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from debe tener formato YYYY-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-15' })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to debe tener formato YYYY-MM-DD.' })
  to?: string;
}
