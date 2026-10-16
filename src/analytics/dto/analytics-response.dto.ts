import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsLocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  timezone!: string;
}

export class AnalyticsDailyPointDto {
  @ApiProperty({ format: 'date' })
  date!: string;

  @ApiProperty()
  visits!: number;
}

export class AnalyticsSummaryResponseDto {
  @ApiProperty()
  totalVisits!: number;

  @ApiProperty({ type: [AnalyticsDailyPointDto] })
  daily!: AnalyticsDailyPointDto[];
}

export class AnalyticsPageResponseDto {
  @ApiProperty()
  path!: string;

  @ApiProperty()
  visits!: number;
}

export class AnalyticsProductResponseDto {
  @ApiProperty()
  resourceType!: string;

  @ApiProperty()
  resourceKey!: string;

  @ApiProperty()
  visits!: number;
}

export class AnalyticsReferrerResponseDto {
  @ApiProperty()
  host!: string;

  @ApiProperty()
  visits!: number;
}
