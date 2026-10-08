import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminLocationListQueryDto } from './menu-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Datos de una categoría nueva. */
export class CreateMenuCategoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ example: 'coffee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  slug!: string;

  @ApiProperty({ example: 'Café' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEs!: string;

  @ApiProperty({ example: 'Coffee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trim)
  descriptionEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trim)
  descriptionEn?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos modificables sin permitir cambiar la sede de una categoría. */
export class UpdateMenuCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trim)
  descriptionEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trim)
  descriptionEn?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderCategoryItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

/** Reemplaza el orden explícito de varias categorías en una sola transacción. */
export class ReorderMenuCategoriesDto {
  @ApiProperty({ type: () => [ReorderCategoryItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItemDto)
  categories!: ReorderCategoryItemDto[];
}

/** Filtros administrativos de categorías. */
export class MenuCategoryListQueryDto extends AdminLocationListQueryDto {}
