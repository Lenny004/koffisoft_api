import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  EventQuoteLineType,
  EventSpaceBookingStatus,
  EventStatus,
  EventType,
  QuoteStatus,
} from '../../generated/prisma/enums.js';
import { PageMetaDto } from '../../reservations/dto/reservation-response.dto.js';

export class PublicEventSpaceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  spaceType!: string;

  @ApiProperty()
  seatedCapacity!: number;

  @ApiPropertyOptional()
  standingCapacity!: number | null;
}

export class PublicEventPackageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  packageCode!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiPropertyOptional()
  descriptionEs!: string | null;

  @ApiPropertyOptional()
  descriptionEn!: string | null;

  @ApiProperty()
  pricingModel!: string;

  @ApiPropertyOptional()
  minGuestCount!: number | null;

  @ApiPropertyOptional()
  maxGuestCount!: number | null;
}

export class PublicEventCatalogResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ type: () => [PublicEventSpaceDto] })
  spaces!: PublicEventSpaceDto[];

  @ApiProperty({ type: () => [PublicEventPackageDto] })
  packages!: PublicEventPackageDto[];
}

export class PublicEventRequestResponseDto {
  @ApiProperty()
  eventCode!: string;

  @ApiProperty({ enum: EventStatus })
  status!: EventStatus;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class EventSpaceBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  venueSpaceId!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  setupStartsAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  teardownEndsAt!: string | null;

  @ApiProperty({ enum: EventSpaceBookingStatus })
  bookingStatus!: EventSpaceBookingStatus;

  @ApiProperty()
  capacityReserved!: number;

  @ApiPropertyOptional({ format: 'date-time' })
  holdExpiresAt!: string | null;
}

export class EventRequirementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty()
  requirementType!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  guestCount!: number | null;

  @ApiProperty()
  severity!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  resolvedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class EventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  eventCode!: string;

  @ApiProperty({ enum: EventType })
  eventType!: EventType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  contactNameSnapshot!: string;

  @ApiProperty()
  contactPhoneSnapshot!: string;

  @ApiPropertyOptional()
  contactEmailSnapshot!: string | null;

  @ApiProperty()
  preferredLanguage!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  setupStartsAt!: string | null;

  @ApiProperty()
  estimatedGuestCount!: number;

  @ApiPropertyOptional()
  confirmedGuestCount!: number | null;

  @ApiPropertyOptional()
  budgetTarget!: string | null;

  @ApiProperty({ enum: EventStatus })
  status!: EventStatus;

  @ApiProperty()
  source!: string;

  @ApiPropertyOptional()
  specialRequirements!: string | null;

  @ApiPropertyOptional()
  internalNotes!: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  coordinatorUserId!: string | null;

  @ApiProperty({ type: () => [EventSpaceBookingResponseDto] })
  spaceBookings!: EventSpaceBookingResponseDto[];

  @ApiProperty({ type: () => [EventRequirementResponseDto] })
  requirements!: EventRequirementResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class EventPageDto {
  @ApiProperty({ type: () => [EventResponseDto] })
  data!: EventResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class EventPackageLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: EventQuoteLineType })
  lineType!: EventQuoteLineType;

  @ApiPropertyOptional({ format: 'uuid' })
  menuItemVariantId!: string | null;

  @ApiProperty()
  labelEs!: string;

  @ApiProperty()
  labelEn!: string;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  unit!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  active!: boolean;
}

export class EventPackageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  packageCode!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiPropertyOptional()
  descriptionEs!: string | null;

  @ApiPropertyOptional()
  descriptionEn!: string | null;

  @ApiProperty()
  pricingModel!: string;

  @ApiProperty()
  basePrice!: string;

  @ApiPropertyOptional()
  minGuestCount!: number | null;

  @ApiPropertyOptional()
  maxGuestCount!: number | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: () => [EventPackageLineResponseDto] })
  lines!: EventPackageLineResponseDto[];
}

export class EventQuoteLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  eventPackageLineId!: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  menuItemVariantId!: string | null;

  @ApiProperty({ enum: EventQuoteLineType })
  lineType!: EventQuoteLineType;

  @ApiProperty()
  labelEs!: string;

  @ApiProperty()
  labelEn!: string;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  unit!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  discountAmount!: string;

  @ApiProperty()
  taxRate!: string;

  @ApiProperty()
  taxableAmount!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  lineTotal!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class EventQuoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  eventPackageId!: string | null;

  @ApiProperty()
  versionNo!: number;

  @ApiProperty({ enum: QuoteStatus })
  status!: QuoteStatus;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ format: 'date' })
  validUntil!: string;

  @ApiProperty()
  subtotalAmount!: string;

  @ApiProperty()
  discountAmount!: string;

  @ApiProperty()
  taxableAmount!: string;

  @ApiProperty()
  taxAmount!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional()
  termsEs!: string | null;

  @ApiPropertyOptional()
  termsEn!: string | null;

  @ApiProperty({ type: () => [EventQuoteLineResponseDto] })
  lines!: EventQuoteLineResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class EventQuotePageDto {
  @ApiProperty({ type: () => [EventQuoteResponseDto] })
  data!: EventQuoteResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}
