import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  AnnouncementListQueryDto,
  CreateAnnouncementDto,
  PublicAnnouncementQueryDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';
import { AnnouncementResponseDto } from './dto/announcement-response.dto.js';
import { AnnouncementsService } from './announcements.service.js';

/** Endpoints públicos y administrativos de avisos importantes. */
@ApiTags('Avisos importantes')
@Controller('announcements')
export class AnnouncementsController {
  constructor(
    private readonly service: AnnouncementsService,
    private readonly scope: AccessScopeService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lista los avisos vigentes de una sede' })
  @ApiResponse({ status: 200, type: [AnnouncementResponseDto] })
  listPublic(@Query() query: PublicAnnouncementQueryDto): Promise<AnnouncementResponseDto[]> {
    return this.service.listPublic(query);
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.read')
  @ApiOperation({ summary: 'Lista avisos importantes para administración' })
  @ApiResponse({ status: 200, type: [AnnouncementResponseDto] })
  listAdmin(
    @Query() query: AnnouncementListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnnouncementResponseDto[]> {
    return this.withLocation(request, query.locationId, () => this.service.listAdmin(query));
  }

  @Post('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.manage')
  @ApiOperation({ summary: 'Crea un aviso importante' })
  @ApiResponse({ status: 201, type: AnnouncementResponseDto })
  create(
    @Body() dto: CreateAnnouncementDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnnouncementResponseDto> {
    return this.withLocation(request, dto.locationId, () => this.service.create(dto));
  }

  @Patch('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un aviso importante' })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
    @Query() query: PublicAnnouncementQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnnouncementResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.update(id, query.locationId, dto),
    );
  }

  @Delete('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva un aviso importante' })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PublicAnnouncementQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnnouncementResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.remove(id, query.locationId),
    );
  }

  private async withLocation<T>(
    request: AuthenticatedRequest,
    locationId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!request.auth?.userId) {
      throw new Error('La ruta administrativa requiere una sesión autenticada.');
    }
    await this.scope.assertLocationAccess(request.auth.userId, locationId);
    return operation();
  }
}
