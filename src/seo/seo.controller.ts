import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AccessScopeService } from '../auth/security/access-scope.service.js';
import {
  CreateSeoMetadataDto,
  PublicSeoQueryDto,
  SeoListQueryDto,
  UpdateSeoMetadataDto,
} from './dto/seo.dto.js';
import { SeoDeleteResponseDto, SeoMetadataResponseDto } from './dto/seo-response.dto.js';
import { SeoService } from './seo.service.js';

/** Expone la resolucion publica y la administracion acotada de SEO. */
@ApiTags('SEO')
@Controller('seo')
export class SeoController {
  constructor(
    private readonly service: SeoService,
    private readonly scope: AccessScopeService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Resuelve SEO publicado por recurso' })
  @ApiResponse({ status: 200, type: SeoMetadataResponseDto })
  getPublic(@Query() query: PublicSeoQueryDto): Promise<SeoMetadataResponseDto> {
    return this.service.getPublic(query);
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('seo.read')
  @ApiOperation({ summary: 'Lista overrides SEO por sede y tipo' })
  @ApiResponse({ status: 200, type: [SeoMetadataResponseDto] })
  async listAdmin(
    @Query() query: SeoListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SeoMetadataResponseDto[]> {
    await this.assertLocation(request, query.locationId);
    return this.service.listAdmin(query);
  }

  @Post('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('seo.manage')
  @ApiOperation({ summary: 'Crea un override SEO' })
  @ApiResponse({ status: 201, type: SeoMetadataResponseDto })
  async create(
    @Body() dto: CreateSeoMetadataDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SeoMetadataResponseDto> {
    await this.assertLocation(request, dto.locationId);
    return this.service.create(dto);
  }

  @Patch('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('seo.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un override SEO' })
  @ApiResponse({ status: 200, type: SeoMetadataResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateSeoMetadataDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SeoMetadataResponseDto> {
    await this.assertLocation(request, locationId);
    return this.service.update(id, locationId, dto);
  }

  @Delete('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('seo.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Elimina un override y restaura defaults' })
  @ApiResponse({ status: 200, type: SeoDeleteResponseDto })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SeoDeleteResponseDto> {
    await this.assertLocation(request, locationId);
    return this.service.remove(id, locationId);
  }

  private async assertLocation(request: AuthenticatedRequest, locationId: string): Promise<void> {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('La ruta administrativa requiere una sesion.');
    await this.scope.assertLocationAccess(userId, locationId);
  }
}

/** Publica feeds XML/texto sin requerir sesion ni permisos administrativos. */
@Controller()
export class SeoFeedController {
  constructor(private readonly service: SeoService) {}

  @Get('sitemap.xml')
  @Public()
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({ summary: 'Genera sitemap desde contenido publicado' })
  /**
   * Expone sitemap.xml generado desde contenido publicado e índices SEO.
   */
  getSitemap(): Promise<string> {
    return this.service.getSitemapXml();
  }

  @Get('robots.txt')
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Genera robots.txt con referencia al sitemap' })
  /**
   * Expone robots.txt con referencia al sitemap público.
   */
  getRobots(): string {
    return this.service.getRobotsTxt();
  }
}
