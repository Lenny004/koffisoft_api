import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SEO_RESOURCE_TYPES, type SeoResourceType } from './seo.dto.js';

export class SeoMetadataResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  id!: string | null;

  @ApiProperty({ enum: SEO_RESOURCE_TYPES })
  resourceType!: SeoResourceType;

  @ApiProperty()
  resourceKey!: string;

  @ApiProperty()
  metaTitle!: string;

  @ApiProperty()
  metaDescription!: string;

  @ApiPropertyOptional({ nullable: true })
  ogImageUrl!: string | null;

  @ApiProperty()
  canonicalUrl!: string;

  @ApiProperty()
  noindex!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  locationId!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  updatedAt!: string | null;
}

export class SeoDeleteResponseDto {
  @ApiProperty()
  deleted!: boolean;
}
