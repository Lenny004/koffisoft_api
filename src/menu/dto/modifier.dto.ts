import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminLocationListQueryDto } from './menu-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateModifierGroupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ example: 'MILK' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trim)
  code!: string;

  @ApiProperty({ example: 'Tipo de leche' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEs!: string;

  @ApiProperty({ example: 'Milk type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEn!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionMin = 0;

  @ApiPropertyOptional({ minimum: 0, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionMax = 1;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

export class UpdateModifierGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trim)
  code?: string;

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

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateModifierDto {
  @ApiProperty({ example: 'ALMOND' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trim)
  code!: string;

  @ApiProperty({ example: 'Leche de almendra' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEs!: string;

  @ApiProperty({ example: 'Almond milk' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trim)
  nameEn!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  priceDelta = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active = true;
}

export class UpdateModifierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trim)
  code?: string;

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

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  priceDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ModifierGroupListQueryDto extends AdminLocationListQueryDto {}

export class AssignModifierGroupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  modifierGroupId!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectionMax?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder = 0;
}

export class ReplaceModifierGroupsDto {
  @ApiProperty({ type: () => [AssignModifierGroupDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssignModifierGroupDto)
  groups!: AssignModifierGroupDto[];
}
