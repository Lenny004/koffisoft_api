import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
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
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Parámetros comunes para recursos administrativos ligados a una sede. */
export class LocationQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Sede cuyo catálogo se consulta.' })
  @IsUUID()
  locationId!: string;
}

/** Filtros del catálogo público. La sede es obligatoria porque el precio y la disponibilidad son locales. */
export class PublicMenuQueryDto extends LocationQueryDto {
  @ApiPropertyOptional({ description: 'Slug de categoría.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimValue)
  category?: string;

  @ApiPropertyOptional({ description: 'Código de alérgeno, por ejemplo GLUTEN.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  allergen?: string;
}

/** Paginación y búsqueda de listados administrativos. */
export class AdminListQueryDto {
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

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimValue)
  search?: string;

  @ApiPropertyOptional({ default: false, description: 'Incluye registros con active=false.' })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeInactive = false;
}

/** Parámetros de un recurso administrativo que pertenece a una sede. */
export class AdminLocationListQueryDto extends AdminListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
}
