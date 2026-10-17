import { Controller, Get, Post, Patch, Query, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SessionGuard } from '../auth/guards/session.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { ResourcesService } from './resources.service.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  CreateResourceDto,
  UpdateResourceDto,
  ResourceListQueryDto,
  CreateMaintenanceScheduleDto,
  CompleteMaintenanceDto,
} from './dto/resource.dto.js';
import {
  ResourceResponseDto,
  ResourcePageDto,
  MaintenanceScheduleResponseDto,
} from './dto/resource-response.dto.js';

/** CRUD administrativo de recursos y mantenimientos programados. */
@ApiTags('resources')
@Controller('resources/admin')
@UseGuards(SessionGuard)
@ApiBearerAuth('session')
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  @Get()
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Listar recursos de una sede' })
  @ApiOkResponse({ type: ResourcePageDto })
  async listResources(@Query() query: ResourceListQueryDto): Promise<ResourcePageDto> {
    return this.service.listResources(query);
  }

  @Get(':id')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Obtener un recurso' })
  @ApiOkResponse({ type: ResourceResponseDto })
  async getResource(
    @Param('id') id: string,
    @Query('locationId') locationId: string,
  ): Promise<ResourceResponseDto> {
    return this.service.getResource(id, locationId);
  }

  @Post()
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Crear un recurso' })
  @ApiOkResponse({ type: ResourceResponseDto })
  async createResource(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateResourceDto,
  ): Promise<ResourceResponseDto> {
    const actorUserId = req.auth?.userId!;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? undefined,
      requestId: req.id,
    };
    return this.service.createResource(dto, actorUserId, metadata);
  }

  @Patch(':id')
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Actualizar un recurso' })
  @ApiOkResponse({ type: ResourceResponseDto })
  async updateResource(
    @Param('id') id: string,
    @Query('locationId') locationId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceResponseDto> {
    const actorUserId = req.auth?.userId!;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? undefined,
      requestId: req.id,
    };
    return this.service.updateResource(id, locationId, dto, actorUserId, metadata);
  }

  @Post('maintenance')
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Programar un mantenimiento' })
  @ApiOkResponse({ type: MaintenanceScheduleResponseDto })
  async scheduleMaintenance(
    @Body() dto: CreateMaintenanceScheduleDto,
  ): Promise<MaintenanceScheduleResponseDto> {
    return this.service.scheduleMaintenance(dto);
  }

  @Patch('maintenance/:id/complete')
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Completar un mantenimiento' })
  @ApiOkResponse({ type: MaintenanceScheduleResponseDto })
  async completeMaintenance(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompleteMaintenanceDto,
  ): Promise<MaintenanceScheduleResponseDto> {
    const actorUserId = req.auth?.userId!;
    return this.service.completeMaintenance(id, dto, actorUserId);
  }
}
