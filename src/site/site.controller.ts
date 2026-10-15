import { Body, Controller, Get, Patch, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { requestMetadata, type AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessScopeService } from '../auth/security/access-scope.service.js';
import { SiteQueryDto, UpdateSiteContentDto } from './dto/site.dto.js';
import { SiteContentResponseDto } from './dto/site-response.dto.js';
import { SiteService } from './site.service.js';

/** Expone la información pública y la edición autorizada del sitio. */
@ApiTags('Sitio')
@Controller('site')
export class SiteController {
  constructor(
    private readonly service: SiteService,
    private readonly scope: AccessScopeService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Consulta los datos públicos de una sede' })
  @ApiResponse({ status: 200, type: SiteContentResponseDto })
  getPublic(@Query() query: SiteQueryDto): Promise<SiteContentResponseDto> {
    return this.service.getSite(query.locationId);
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('site_content.read')
  @ApiOperation({ summary: 'Consulta el contenido editable de una sede' })
  @ApiResponse({ status: 200, type: SiteContentResponseDto })
  async getAdmin(
    @Query() query: SiteQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SiteContentResponseDto> {
    await this.assertLocation(request, query.locationId);
    return this.service.getSite(query.locationId);
  }

  @Patch('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('site_content.manage')
  @ApiOperation({ summary: 'Actualiza el contenido editorial y operativo de una sede' })
  @ApiResponse({ status: 200, type: SiteContentResponseDto })
  async update(
    @Query() query: SiteQueryDto,
    @Body() dto: UpdateSiteContentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SiteContentResponseDto> {
    await this.assertLocation(request, query.locationId);
    return this.service.updateSite(
      query.locationId,
      dto,
      this.requiredUserId(request),
      requestMetadata(request),
    );
  }

  private async assertLocation(request: AuthenticatedRequest, locationId: string): Promise<void> {
    const userId = this.requiredUserId(request);
    await this.scope.assertLocationAccess(userId, locationId);
  }

  private requiredUserId(request: AuthenticatedRequest): string {
    if (!request.auth)
      throw new UnauthorizedException('La ruta administrativa requiere una sesión autenticada.');
    return request.auth.userId;
  }
}
