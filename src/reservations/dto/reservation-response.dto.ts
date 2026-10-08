import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ReservationStatus, ReservationTableStatus } from '../../generated/prisma/enums.js';

export class PageMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PublicAvailabilitySpaceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  seatedCapacity!: number;

  @ApiPropertyOptional()
  standingCapacity!: number | null;

  @ApiProperty()
  available!: boolean;
}

export class PublicAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ example: 'America/El_Salvador' })
  timezone!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ type: () => [PublicAvailabilitySpaceDto] })
  spaces!: PublicAvailabilitySpaceDto[];
}

export class PublicReservationResponseDto {
  @ApiProperty()
  reservationCode!: string;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty()
  partySize!: number;
}

export class VenueSpaceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

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

  @ApiProperty()
  allowsTableReservation!: boolean;

  @ApiProperty()
  allowsPrivateEvent!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  tableCount!: number;
}

export class DiningTableResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  spaceId!: string;

  @ApiProperty()
  tableCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  seatCount!: number;

  @ApiProperty()
  shape!: string;

  @ApiProperty()
  active!: boolean;
}

export class ReservationTableResponseDto extends DiningTableResponseDto {
  @ApiProperty({ format: 'uuid' })
  reservationTableId!: string;

  @ApiProperty({ enum: ReservationTableStatus })
  allocationStatus!: ReservationTableStatus;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class ReservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  reservationCode!: string;

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

  @ApiProperty()
  partySize!: number;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  @ApiProperty()
  source!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  preferredSpaceId!: string | null;

  @ApiPropertyOptional()
  specialRequests!: string | null;

  @ApiPropertyOptional()
  internalNotes!: string | null;

  @ApiProperty({ type: () => [ReservationTableResponseDto] })
  tables!: ReservationTableResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ReservationPageDto {
  @ApiProperty({ type: () => [ReservationResponseDto] })
  data!: ReservationResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}
