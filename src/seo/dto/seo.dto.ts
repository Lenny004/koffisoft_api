import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SEO_RESOURCE_TYPES = ['menu_item', 'event', 'announcement', 'page'] as const;
export type SeoResourceType = (typeof SEO_RESOURCE_TYPES)[number];

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Consulta publica de metadatos para una clave editorial concreta. */
export class PublicSeoQueryDto {
  @ApiProperty({ enum: SEO_RESOURCE_TYPES })
  @IsIn(SEO_RESOURCE_TYPES)
  resourceType!: SeoResourceType;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/u)
  @Transform(trimValue)
  resourceKey!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Sede que contextualiza el recurso.' })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

/** Filtro administrativo acotado a una sede autorizada. */
export class SeoListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ enum: SEO_RESOURCE_TYPES })
  @IsOptional()
  @IsIn(SEO_RESOURCE_TYPES)
  resourceType?: SeoResourceType;
}

/** Crea un override SEO; los textos vacios se sustituyen por defaults del recurso. */
export class CreateSeoMetadataDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ enum: SEO_RESOURCE_TYPES })
  @IsIn(SEO_RESOURCE_TYPES)
  resourceType!: SeoResourceType;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/u)
  @Transform(trimValue)
  resourceKey!: string;

  @ApiPropertyOptional({ maxLength: 70 })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  @Transform(trimValue)
  metaTitle?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(trimValue)
  metaDescription?: string;

  @ApiPropertyOptional({ maxLength: 500, format: 'uri' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  ogImageUrl?: string;

  @ApiPropertyOptional({ maxLength: 500, format: 'uri' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  canonicalUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  noindex = false;
}

/** Actualiza solo los campos editables de un override existente. */
export class UpdateSeoMetadataDto {
  @ApiPropertyOptional({ maxLength: 70 })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  @Transform(trimValue)
  metaTitle?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(trimValue)
  metaDescription?: string;

  @ApiPropertyOptional({ maxLength: 500, format: 'uri' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  ogImageUrl?: string;

  @ApiPropertyOptional({ maxLength: 500, format: 'uri' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimValue)
  canonicalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noindex?: boolean;
}
