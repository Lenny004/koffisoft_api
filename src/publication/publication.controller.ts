import {
  BadRequestException,
  Controller,
  Body,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessScopeService } from '../auth/security/access-scope.service.js';
import {
  PUBLICATION_RESOURCE_TYPES,
  type PublicationAction,
  type PublicationResourceType,
  PublicationLocationQueryDto,
  UpdatePublicationDto,
} from './dto/publication.dto.js';
import {
  PreviewResponseDto,
  PreviewTokenResponseDto,
  PublicationContextResponseDto,
  PublicationResponseDto,
} from './dto/publication-response.dto.js';
import { PublicationService } from './publication.service.js';

const resourcePermissions: Record<PublicationResourceType, { read: string; manage: string }> = {
  announcement: { read: 'important_announcements.read', manage: 'important_announcements.manage' },
  event: { read: 'events.read', manage: 'events.manage' },
  menu_item: { read: 'catalog.read', manage: 'catalog.manage' },
};

/** Controla la publicación de recursos existentes sin exponer la persistencia a los frontends. */
@ApiTags('Publicación editorial')
@Controller('publication')
export class PublicationController {
  constructor(
    private readonly service: PublicationService,
    private readonly scope: AccessScopeService,
  ) {}

  @Get('admin/context')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('content.publish')
  @ApiOperation({ summary: 'Devuelve la zona horaria editorial de una sede' })
  @ApiResponse({ status: 200, type: PublicationContextResponseDto })
  async context(
    @Query() query: PublicationLocationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicationContextResponseDto> {
    await this.assertScope(request, query.locationId);
    return this.service.getContext(query.locationId);
  }

  @Post('admin/:resourceType/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('content.publish')
  @ApiParam({ name: 'resourceType', enum: PUBLICATION_RESOURCE_TYPES })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Guarda borrador, programa, publica o despublica contenido' })
  @ApiResponse({ status: 200, type: PublicationResponseDto })
  async update(
    @Param('resourceType') resourceType: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PublicationLocationQueryDto,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePublicationDto,
  ): Promise<PublicationResponseDto> {
    const typedResource = this.validateResourceType(resourceType);
    this.assertPermissions(request, typedResource, dto.action);
    await this.assertScope(request, query.locationId);
    return this.service.updatePublication(
      typedResource,
      id,
      query.locationId,
      dto,
      request.auth!.userId,
    );
  }

  @Post('admin/:resourceType/:id/preview')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('content.publish')
  @ApiParam({ name: 'resourceType', enum: PUBLICATION_RESOURCE_TYPES })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Genera un token opaco de vista previa de corta duración' })
  @ApiResponse({ status: 201, type: PreviewTokenResponseDto })
  async preview(
    @Param('resourceType') resourceType: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PublicationLocationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PreviewTokenResponseDto> {
    const typedResource = this.validateResourceType(resourceType);
    this.assertPermissions(request, typedResource, 'preview');
    await this.assertScope(request, query.locationId);
    return this.service.createPreview(typedResource, id, query.locationId, request.auth!.userId);
  }

  @Get('preview/:token')
  @Public()
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Consume una vista previa editorial de un solo uso' })
  @ApiResponse({ status: 200, type: PreviewResponseDto })
  consumePreview(@Param('token') token: string): Promise<PreviewResponseDto> {
    return this.service.consumePreview(token);
  }

  private validateResourceType(value: string): PublicationResourceType {
    if ((PUBLICATION_RESOURCE_TYPES as readonly string[]).includes(value)) {
      return value as PublicationResourceType;
    }
    throw new BadRequestException('Tipo de contenido no válido.');
  }

  private assertPermissions(
    request: AuthenticatedRequest,
    resourceType: PublicationResourceType,
    action: PublicationAction | 'preview',
  ): void {
    const permissions = request.auth?.permissions ?? [];
    const required = resourcePermissions[resourceType];
    if (!permissions.includes(required.read)) {
      throw new ForbiddenException(`Falta el permiso ${required.read}.`);
    }
    if (action !== 'preview' && !permissions.includes(required.manage)) {
      throw new ForbiddenException(`Falta el permiso ${required.manage}.`);
    }
  }

  private async assertScope(request: AuthenticatedRequest, locationId: string): Promise<void> {
    if (!request.auth?.userId)
      throw new ForbiddenException('La ruta administrativa requiere una sesión autenticada.');
    await this.scope.assertLocationAccess(request.auth.userId, locationId);
  }
}
