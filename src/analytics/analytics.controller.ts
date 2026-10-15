import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AccessScopeService } from '../auth/security/access-scope.service.js';
import { AnalyticsRangeQueryDto, CreatePageViewDto } from './dto/analytics.dto.js';
import {
  AnalyticsLocationResponseDto,
  AnalyticsPageResponseDto,
  AnalyticsProductResponseDto,
  AnalyticsReferrerResponseDto,
  AnalyticsSummaryResponseDto,
} from './dto/analytics-response.dto.js';
import { AnalyticsService } from './analytics.service.js';

/** Captura visitas publicas anonimas y expone sus agregados a usuarios autorizados. */
@ApiTags('Analiticas')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly service: AnalyticsService,
    private readonly scope: AccessScopeService,
  ) {}

  @Post('page-view')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Registra una visita publica agregada sin cookies' })
  @ApiResponse({ status: 204, description: 'Visita aceptada o descartada.' })
  async recordPageView(
    @Body() dto: CreatePageViewDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.recordPageView(dto, request.headers['user-agent']);
  }

  @Get('admin/locations')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lista sedes visibles para el reporte de analiticas' })
  @ApiResponse({ status: 200, type: [AnalyticsLocationResponseDto] })
  listLocations(@Req() request: AuthenticatedRequest): Promise<AnalyticsLocationResponseDto[]> {
    return this.service.listLocations(this.actorId(request));
  }

  @Get('admin/summary')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Resume visitas por día' })
  @ApiResponse({ status: 200, type: AnalyticsSummaryResponseDto })
  async summary(
    @Query() query: AnalyticsRangeQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnalyticsSummaryResponseDto> {
    await this.assertLocation(request, query.locationId);
    return this.service.getSummary(query);
  }

  @Get('admin/pages')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lista visitas por página' })
  @ApiResponse({ status: 200, type: [AnalyticsPageResponseDto] })
  async pages(
    @Query() query: AnalyticsRangeQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnalyticsPageResponseDto[]> {
    await this.assertLocation(request, query.locationId);
    return this.service.getPages(query);
  }

  @Get('admin/products')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lista visitas por plato y evento' })
  @ApiResponse({ status: 200, type: [AnalyticsProductResponseDto] })
  async products(
    @Query() query: AnalyticsRangeQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnalyticsProductResponseDto[]> {
    await this.assertLocation(request, query.locationId);
    return this.service.getProducts(query);
  }

  @Get('admin/referrers')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('analytics.read')
  @ApiOperation({ summary: 'Lista visitas por dominio de referencia' })
  @ApiResponse({ status: 200, type: [AnalyticsReferrerResponseDto] })
  async referrers(
    @Query() query: AnalyticsRangeQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnalyticsReferrerResponseDto[]> {
    await this.assertLocation(request, query.locationId);
    return this.service.getReferrers(query);
  }

  private async assertLocation(request: AuthenticatedRequest, locationId: string): Promise<void> {
    await this.scope.assertLocationAccess(this.actorId(request), locationId);
  }

  private actorId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('La ruta administrativa requiere una sesión.');
    return userId;
  }
}
