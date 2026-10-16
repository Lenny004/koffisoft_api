import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PUBLICATION_RESOURCE_TYPES = ['announcement', 'event', 'menu_item'] as const;
export type PublicationResourceType = (typeof PUBLICATION_RESOURCE_TYPES)[number];

export const PUBLICATION_ACTIONS = ['draft', 'schedule', 'publish', 'unpublish'] as const;
export type PublicationAction = (typeof PUBLICATION_ACTIONS)[number];

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Acción editorial y sus fechas en ISO con zona explícita. */
export class UpdatePublicationDto {
  @ApiProperty({ enum: PUBLICATION_ACTIONS })
  @IsIn(PUBLICATION_ACTIONS)
  action!: PublicationAction;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

/** Sede usada para comprobar alcance antes de mutar el recurso editorial. */
export class PublicationLocationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @Transform(trimValue)
  locationId!: string;
}
