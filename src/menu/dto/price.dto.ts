import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuChannel } from '../../generated/prisma/enums.js';
import { AdminListQueryDto } from './menu-query.dto.js';

/** Precio con vigencia explícita para una sede y canal. */
export class CreateMenuPriceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ enum: MenuChannel, example: MenuChannel.Web })
  @IsEnum(MenuChannel)
  channel!: MenuChannel;

  @ApiProperty({ example: 8.95, minimum: 0, maximum: 9_999_999_999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  price!: number;

  @ApiPropertyOptional({ default: 'USD', readOnly: true })
  currency = 'USD';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includesTax = true;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  taxRateId!: string;

  @ApiProperty({ example: '2026-01-01', format: 'date' })
  @IsDateString({ strict: true })
  validFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

/** Campos que pueden corregirse en una fila de historial de precios. */
export class UpdateMenuPriceDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  price?: number;

  @ApiPropertyOptional({ enum: MenuChannel })
  @IsOptional()
  @IsEnum(MenuChannel)
  channel?: MenuChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includesTax?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  taxRateId?: string;

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

/** Filtros del historial de precios de una variante. */
export class MenuPriceListQueryDto extends AdminListQueryDto {}
