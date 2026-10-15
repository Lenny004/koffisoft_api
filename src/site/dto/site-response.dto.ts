import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SiteLocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'uuid' })
  businessId!: string;

  @ApiProperty()
  addressLine!: string;

  @ApiProperty()
  municipality!: string;

  @ApiProperty()
  department!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude!: number | null;

  @ApiProperty()
  timezone!: string;
}

export class SiteHourResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  serviceType!: string;

  @ApiProperty({ minimum: 1, maximum: 7 })
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  opensAt!: string;

  @ApiProperty({ example: '19:00' })
  closesAt!: string;

  @ApiProperty()
  crossesMidnight!: boolean;

  @ApiProperty()
  active!: boolean;
}

export class SiteHourOverrideResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date' })
  serviceDate!: string;

  @ApiProperty()
  serviceType!: string;

  @ApiPropertyOptional({ nullable: true, example: '08:00' })
  opensAt!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '15:00' })
  closesAt!: string | null;

  @ApiProperty()
  isClosed!: boolean;

  @ApiProperty()
  reason!: string;
}

export class SiteTeamMemberResponseDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  description!: string;
}

export class SiteProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  businessId!: string;

  @ApiProperty()
  heroEyebrow!: string;

  @ApiProperty()
  heroTitle!: string;

  @ApiProperty()
  heroDescription!: string;

  @ApiPropertyOptional({ nullable: true })
  heroImageUrl!: string | null;

  @ApiProperty()
  aboutTitle!: string;

  @ApiProperty()
  aboutDescription!: string;

  @ApiProperty()
  aboutMission!: string;

  @ApiProperty()
  aboutVision!: string;

  @ApiProperty({ type: [SiteTeamMemberResponseDto] })
  aboutTeam!: SiteTeamMemberResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  socialFacebookUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  socialInstagramUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  socialTikTokUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class SiteContentResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ type: SiteLocationResponseDto })
  location!: SiteLocationResponseDto;

  @ApiProperty({ type: [SiteHourResponseDto] })
  hours!: SiteHourResponseDto[];

  @ApiProperty({ type: [SiteHourOverrideResponseDto] })
  overrides!: SiteHourOverrideResponseDto[];

  @ApiPropertyOptional({ type: SiteProfileResponseDto, nullable: true })
  profile!: SiteProfileResponseDto | null;
}
