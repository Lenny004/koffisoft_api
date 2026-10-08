import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ReservationStatus } from '../generated/prisma/enums.js';
import {
  AssignReservationTablesDto,
  CreateDiningTableDto,
  CreatePublicReservationDto,
  CreateVenueSpaceDto,
  DiningTableListQueryDto,
  ReservationAvailabilityQueryDto,
  ReservationListQueryDto,
  UpdateDiningTableDto,
  UpdateVenueSpaceDto,
  VenueListQueryDto,
} from './dto/reservation.dto.js';
import {
  DiningTableResponseDto,
  PublicAvailabilityResponseDto,
  PublicReservationResponseDto,
  ReservationPageDto,
  ReservationResponseDto,
  VenueSpaceResponseDto,
} from './dto/reservation-response.dto.js';
import { ReservationsService } from './reservations.service.js';

/** Endpoints públicos y administrativos de mesas y reservas. */
@ApiTags('Reservas')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get('availability')
  @Public()
  @ApiOperation({ summary: 'Consulta espacios disponibles por fecha, hora y grupo' })
  @ApiResponse({ status: 200, type: PublicAvailabilityResponseDto })
  async availability(
    @Query() query: ReservationAvailabilityQueryDto,
  ): Promise<PublicAvailabilityResponseDto> {
    return this.service.getPublicAvailability(query);
  }

  @Post()
  @Public()
  @ApiOperation({ summary: 'Envía una solicitud pública de reserva' })
  @ApiResponse({ status: 201, type: PublicReservationResponseDto })
  async createPublic(
    @Body() dto: CreatePublicReservationDto,
  ): Promise<PublicReservationResponseDto> {
    return this.service.createPublicReservation(dto);
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.read')
  @ApiOperation({ summary: 'Lista reservas con filtros y paginación' })
  @ApiResponse({ status: 200, type: ReservationPageDto })
  async list(@Query() query: ReservationListQueryDto): Promise<ReservationPageDto> {
    return this.service.listReservations(query);
  }

  @Get('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle administrativo de una reserva' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async get(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.service.getReservation(id);
  }

  @Post('admin/:id/confirm')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Confirma una reserva' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async confirm(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.service.transitionReservation(id, ReservationStatus.Confirmed);
  }

  @Post('admin/:id/seat')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Marca una reserva como sentada' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async seat(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.service.transitionReservation(id, ReservationStatus.Seated);
  }

  @Post('admin/:id/complete')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Completa una reserva' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async complete(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.service.transitionReservation(id, ReservationStatus.Completed);
  }

  @Post('admin/:id/cancel')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Cancela una reserva y libera sus mesas' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async cancel(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.service.transitionReservation(id, ReservationStatus.Cancelled);
  }

  @Post('admin/:id/no-show')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Marca una reserva como no-show y libera sus mesas' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async noShow(@Param('id') id: string): Promise<ReservationResponseDto> {
    return this.service.transitionReservation(id, ReservationStatus.NoShow);
  }

  @Put('admin/:id/tables')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Asigna o reasigna mesas sin traslapes' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async assignTables(
    @Param('id') id: string,
    @Body() dto: AssignReservationTablesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ReservationResponseDto> {
    return this.service.assignTables(id, dto, request.auth?.userId);
  }

  @Get('admin-spaces')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.read')
  @ApiOperation({ summary: 'Lista espacios de una sede' })
  @ApiResponse({ status: 200, type: [VenueSpaceResponseDto] })
  async listSpaces(@Query() query: VenueListQueryDto): Promise<VenueSpaceResponseDto[]> {
    return this.service.listSpaces(query);
  }

  @Get('admin-spaces/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un espacio' })
  @ApiResponse({ status: 200, type: VenueSpaceResponseDto })
  async getSpace(@Param('id') id: string): Promise<VenueSpaceResponseDto> {
    return this.service.getSpace(id);
  }

  @Post('admin-spaces')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Crea un espacio' })
  @ApiResponse({ status: 201, type: VenueSpaceResponseDto })
  async createSpace(@Body() dto: CreateVenueSpaceDto): Promise<VenueSpaceResponseDto> {
    return this.service.createSpace(dto);
  }

  @Patch('admin-spaces/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un espacio' })
  @ApiResponse({ status: 200, type: VenueSpaceResponseDto })
  async updateSpace(
    @Param('id') id: string,
    @Body() dto: UpdateVenueSpaceDto,
  ): Promise<VenueSpaceResponseDto> {
    return this.service.updateSpace(id, dto);
  }

  @Delete('admin-spaces/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un espacio' })
  @ApiResponse({ status: 200, type: VenueSpaceResponseDto })
  async deleteSpace(@Param('id') id: string): Promise<VenueSpaceResponseDto> {
    return this.service.deleteSpace(id);
  }

  @Get('admin-tables')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.read')
  @ApiOperation({ summary: 'Lista mesas, opcionalmente filtradas por espacio' })
  @ApiResponse({ status: 200, type: [DiningTableResponseDto] })
  async listTables(@Query() query: DiningTableListQueryDto): Promise<DiningTableResponseDto[]> {
    return this.service.listTables(query.spaceId);
  }

  @Get('admin-tables/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una mesa' })
  @ApiResponse({ status: 200, type: DiningTableResponseDto })
  async getTable(@Param('id') id: string): Promise<DiningTableResponseDto> {
    return this.service.getTable(id);
  }

  @Post('admin-tables')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiOperation({ summary: 'Crea una mesa dentro de un espacio' })
  @ApiResponse({ status: 201, type: DiningTableResponseDto })
  async createTable(@Body() dto: CreateDiningTableDto): Promise<DiningTableResponseDto> {
    return this.service.createTable(dto);
  }

  @Patch('admin-tables/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza una mesa' })
  @ApiResponse({ status: 200, type: DiningTableResponseDto })
  async updateTable(
    @Param('id') id: string,
    @Body() dto: UpdateDiningTableDto,
  ): Promise<DiningTableResponseDto> {
    return this.service.updateTable(id, dto);
  }

  @Delete('admin-tables/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('reservations.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente una mesa' })
  @ApiResponse({ status: 200, type: DiningTableResponseDto })
  async deleteTable(@Param('id') id: string): Promise<DiningTableResponseDto> {
    return this.service.deleteTable(id);
  }
}
