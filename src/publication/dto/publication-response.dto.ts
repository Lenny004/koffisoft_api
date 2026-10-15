import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PublicationStatus } from '../../generated/prisma/enums.js';

export class PublicationResponseDto {
  @ApiProperty({ enum: ['announcement', 'event', 'menu_item'] })
  resourceType!: string;

  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ enum: PublicationStatus })
  publicationStatus!: PublicationStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  scheduledAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  expiresAt!: string | null;
}

export class PreviewTokenResponseDto {
  @ApiProperty({ enum: ['announcement', 'event', 'menu_item'] })
  resourceType!: string;

  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiProperty({ example: '/preview/opaque-token' })
  previewPath!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class PublicationContextResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ example: 'America/El_Salvador' })
  timezone!: string;
}

export class PreviewResponseDto {
  @ApiProperty({ enum: ['announcement', 'event', 'menu_item'] })
  resourceType!: string;

  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  noindex = true;

  @ApiProperty({ type: 'object', additionalProperties: true })
  resource!: Record<string, unknown>;
}
