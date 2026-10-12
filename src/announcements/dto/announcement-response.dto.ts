import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
