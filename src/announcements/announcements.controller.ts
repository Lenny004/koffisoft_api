import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
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
  constructor(private readonly service: AnnouncementsService) {}

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
  listAdmin(@Query() query: AnnouncementListQueryDto): Promise<AnnouncementResponseDto[]> {
    return this.service.listAdmin(query);
  }

  @Post('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.manage')
  @ApiOperation({ summary: 'Crea un aviso importante' })
  @ApiResponse({ status: 201, type: AnnouncementResponseDto })
  create(@Body() dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    return this.service.create(dto);
  }

  @Patch('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un aviso importante' })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('important_announcements.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva un aviso importante' })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  remove(@Param('id') id: string): Promise<AnnouncementResponseDto> {
    return this.service.remove(id);
  }
}
