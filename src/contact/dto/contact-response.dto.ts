import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ContactMessageStatus } from '../../generated/prisma/enums.js';

export class ContactRelationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;
}

export class ContactAuditResponseDto {
  @ApiProperty()
  action!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ApiPropertyOptional()
  actorUsername!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ContactMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  customerId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reservationId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  eventId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  languageCode!: string;

  @ApiProperty()
  topic!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: ContactMessageStatus })
  status!: ContactMessageStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedToUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  assignedToUsername!: string | null;

  @ApiPropertyOptional({ nullable: true })
  customer!: ContactRelationResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  reservation!: ContactRelationResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  event!: ContactRelationResponseDto | null;

  @ApiProperty({ format: 'date-time' })
  receivedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  repliedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  archivedByUserId!: string | null;

  @ApiProperty({ type: () => [ContactAuditResponseDto] })
  audit!: ContactAuditResponseDto[];
}

export class ContactPageMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ContactMessagePageDto {
  @ApiProperty({ type: () => [ContactMessageResponseDto] })
  data!: ContactMessageResponseDto[];

  @ApiProperty({ type: () => ContactPageMetaDto })
  meta!: ContactPageMetaDto;
}

export class PublicContactMessageResponseDto {
  @ApiProperty()
  accepted = true;
}

export class ContactConversionResponseDto {
  @ApiProperty({ enum: ['customer', 'reservation', 'event'] })
  type!: 'customer' | 'reservation' | 'event';

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  created!: boolean;
}
