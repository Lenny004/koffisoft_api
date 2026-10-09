import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminListQueryDto } from './menu-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Datos de una presentación vendible del ítem. */
export class CreateMenuItemVariantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  prepStationId!: string;

  @ApiProperty({ example: 'DRINK-COFFEE-001-HOT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Transform(trim)
  sku!: string;

  @ApiProperty({ example: 'Caliente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  nameEs!: string;

  @ApiProperty({ example: 'Hot' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  nameEn!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos modificables de una variante existente. */
export class UpdateMenuItemVariantDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  prepStationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Transform(trim)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  nameEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Paginación de variantes de un ítem. */
export class MenuVariantListQueryDto extends AdminListQueryDto {}
