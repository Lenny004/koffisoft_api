import { IsOptional, IsString, IsDateString, IsInt, Min, Max, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AuditLogQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  readonly actorUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readonly dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readonly dateTo?: string;
}

export class AuditLogResponseDto {
  readonly id!: string;
  readonly actorUserId!: string | null;
  readonly action!: string;
  readonly entityType!: string;
  readonly entityId!: string | null;
  readonly beforeData!: Record<string, unknown> | null;
  readonly afterData!: Record<string, unknown> | null;
  readonly requestId!: string | null;
  readonly ipAddress!: string | null;
  readonly createdAt!: string;
}

export class AuditLogPageDto {
  readonly data!: AuditLogResponseDto[];
  readonly meta!: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
