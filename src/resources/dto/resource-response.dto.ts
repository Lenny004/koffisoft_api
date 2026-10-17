import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ResourceCategory, ResourceStatus } from '../../generated/prisma/enums.js';

export class ResourceResponseDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly locationId!: string;

  @ApiProperty()
  readonly resourceCode!: string;

  @ApiProperty()
  readonly name!: string;

  @ApiProperty({ enum: ResourceCategory })
  readonly category!: ResourceCategory;

  @ApiProperty({ nullable: true })
  readonly location!: string | null;

  @ApiProperty({ enum: ResourceStatus })
  readonly status!: ResourceStatus;

  @ApiProperty({ nullable: true })
  readonly purchaseDate!: string | null;

  @ApiProperty({ nullable: true })
  readonly cost!: string | null;

  @ApiProperty({ nullable: true })
  readonly supplierId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly supplierName?: string | null;

  @ApiProperty({ nullable: true })
  readonly notes!: string | null;

  @ApiProperty()
  readonly active!: boolean;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}

export class ResourcePageDto {
  @ApiProperty({ type: [ResourceResponseDto] })
  readonly data!: ResourceResponseDto[];

  @ApiProperty()
  readonly meta!: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export class MaintenanceScheduleResponseDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly resourceId!: string;

  @ApiProperty()
  readonly scheduledDate!: string;

  @ApiProperty()
  readonly description!: string;

  @ApiProperty()
  readonly completed!: boolean;

  @ApiProperty({ nullable: true })
  readonly completedAt!: string | null;

  @ApiProperty({ nullable: true })
  readonly completedByUserId!: string | null;

  @ApiProperty({ nullable: true })
  readonly notes!: string | null;

  @ApiProperty()
  readonly createdAt!: string;
}
