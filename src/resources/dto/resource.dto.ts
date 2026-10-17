import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsDecimal,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

import { ResourceCategory, ResourceStatus } from '../../generated/prisma/enums.js';

export class CreateResourceDto {
  @ApiProperty()
  @IsUUID()
  readonly locationId!: string;

  @ApiProperty()
  @IsString()
  readonly resourceCode!: string;

  @ApiProperty()
  @IsString()
  readonly name!: string;

  @ApiProperty({ enum: ResourceCategory })
  @IsEnum(ResourceCategory)
  readonly category!: ResourceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly location?: string;

  @ApiPropertyOptional({ enum: ResourceStatus })
  @IsOptional()
  @IsEnum(ResourceStatus)
  readonly status?: ResourceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readonly purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal()
  readonly cost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  readonly supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  readonly active!: boolean;
}

export class UpdateResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly resourceCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiPropertyOptional({ enum: ResourceCategory })
  @IsOptional()
  @IsEnum(ResourceCategory)
  readonly category?: ResourceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly location?: string;

  @ApiPropertyOptional({ enum: ResourceStatus })
  @IsOptional()
  @IsEnum(ResourceStatus)
  readonly status?: ResourceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readonly purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal()
  readonly cost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  readonly supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  readonly active?: boolean;
}

export class ResourceListQueryDto {
  @ApiProperty()
  @IsUUID()
  readonly locationId!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly pageSize: number = 20;

  @ApiPropertyOptional({ enum: ResourceCategory })
  @IsOptional()
  @IsEnum(ResourceCategory)
  readonly category?: ResourceCategory;

  @ApiPropertyOptional({ enum: ResourceStatus })
  @IsOptional()
  @IsEnum(ResourceStatus)
  readonly status?: ResourceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  readonly includeInactive?: boolean;
}

export class CreateMaintenanceScheduleDto {
  @ApiProperty()
  @IsUUID()
  readonly resourceId!: string;

  @ApiProperty()
  @IsDateString()
  readonly scheduledDate!: string;

  @ApiProperty()
  @IsString()
  readonly description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly notes?: string;
}

export class CompleteMaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly notes?: string;
}
