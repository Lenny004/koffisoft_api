import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PublicationStatus } from '../../generated/prisma/enums.js';

export class AnnouncementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  ctaLabel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ctaUrl!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  startsAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  endsAt!: string | null;

  @ApiProperty({ enum: PublicationStatus })
  publicationStatus!: PublicationStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  publishedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  scheduledAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  expiresAt!: string | null;

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
