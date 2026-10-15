import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;
const SERVICE_TYPE_PATTERN = /^[a-z][a-z0-9_-]*$/u;

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Identifica la sede cuyo contenido operativo se edita. */
export class SiteQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
}

/** Campos de dirección y contacto que pertenecen a una sede. */
export class SiteLocationDto {
  @ApiProperty({ maxLength: 1_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  @Transform(trimValue)
  addressLine!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  municipality!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  department!: string;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  @Transform(trimValue)
  email?: string | null;

  @ApiPropertyOptional({ minimum: -90, maximum: 90, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}

/** Horario recurrente de un servicio en una sede. */
export class SiteHourDto {
  @ApiProperty({ maxLength: 30, example: 'restaurant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(SERVICE_TYPE_PATTERN)
  @Transform(trimValue)
  serviceType!: string;

  @ApiProperty({ minimum: 1, maximum: 7, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ pattern: TIME_PATTERN.source, example: '08:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  opensAt!: string;

  @ApiProperty({ pattern: TIME_PATTERN.source, example: '19:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  closesAt!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  crossesMidnight = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active = true;
}

/** Excepción de horario aplicable a una fecha concreta. */
export class SiteHourOverrideDto {
  @ApiProperty({ format: 'date' })
  @IsDateString()
  serviceDate!: string;

  @ApiProperty({ maxLength: 30, example: 'restaurant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(SERVICE_TYPE_PATTERN)
  @Transform(trimValue)
  serviceType!: string;

  @ApiPropertyOptional({ pattern: TIME_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  opensAt?: string | null;

  @ApiPropertyOptional({ pattern: TIME_PATTERN.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  closesAt?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isClosed = false;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  reason!: string;
}

/** Persona mostrada en la sección Nosotros. */
export class SiteTeamMemberDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  name!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  role!: string;

  @ApiProperty({ maxLength: 2_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  @Transform(trimValue)
  description!: string;
}

/** Contenido editorial común al negocio, independiente de la sede. */
export class SiteProfileDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimValue)
  heroEyebrow!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  heroTitle!: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  heroDescription!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  @Transform(trimValue)
  heroImageUrl?: string | null;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  aboutTitle!: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  aboutDescription!: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  aboutMission!: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  @Transform(trimValue)
  aboutVision!: string;

  @ApiProperty({ type: [SiteTeamMemberDto], maxItems: 12 })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SiteTeamMemberDto)
  aboutTeam!: SiteTeamMemberDto[];

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  @Transform(trimValue)
  socialFacebookUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  @Transform(trimValue)
  socialInstagramUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  @Transform(trimValue)
  socialTikTokUrl?: string | null;
}

/** Reemplazo atómico del contenido operativo y editorial de una sede. */
export class UpdateSiteContentDto {
  @ApiProperty({ type: SiteLocationDto })
  @ValidateNested()
  @Type(() => SiteLocationDto)
  location!: SiteLocationDto;

  @ApiProperty({ type: SiteProfileDto })
  @ValidateNested()
  @Type(() => SiteProfileDto)
  profile!: SiteProfileDto;

  @ApiProperty({ type: [SiteHourDto], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SiteHourDto)
  hours!: SiteHourDto[];

  @ApiProperty({ type: [SiteHourOverrideDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SiteHourOverrideDto)
  overrides!: SiteHourOverrideDto[];
}
