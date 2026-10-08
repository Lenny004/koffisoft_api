import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuItemType } from '../../generated/prisma/enums.js';
import { AdminLocationListQueryDto } from './menu-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Datos de un ítem comercial del menú. Las variantes se administran en su propio recurso. */
export class CreateMenuItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'DRINK-COFFEE-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trim)
  sku!: string;

  @ApiProperty({ example: 'latte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trim)
  slug!: string;

  @ApiProperty({ enum: MenuItemType, example: MenuItemType.Beverage })
  @IsEnum(MenuItemType)
  itemType!: MenuItemType;

  @ApiProperty({ example: 'Latte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trim)
  nameEs!: string;

  @ApiProperty({ example: 'Latte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  publicVisible = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos modificables de un ítem existente. */
export class UpdateMenuItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trim)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trim)
  slug?: string;

  @ApiPropertyOptional({ enum: MenuItemType })
  @IsOptional()
  @IsEnum(MenuItemType)
  itemType?: MenuItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trim)
  nameEs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publicVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Filtros administrativos de ítems. */
export class MenuItemListQueryDto extends AdminLocationListQueryDto {}

/** Activa o desactiva lógicamente un recurso que tiene campo active. */
export class ActiveStatusDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}
