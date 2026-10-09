import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  CreateEventDto,
  CreateEventPackageDto,
  CreateEventRequirementDto,
  CreateEventSpaceBookingDto,
  CreateEventQuoteDto,
  CreatePublicEventRequestDto,
  EventListQueryDto,
  EventPackageListQueryDto,
  PublicEventCatalogQueryDto,
  UpdateEventDto,
  UpdateEventPackageDto,
  UpdateEventQuoteStatusDto,
  UpdateEventRequirementDto,
} from './dto/event.dto.js';
import {
  EventPageDto,
  EventPackageResponseDto,
  EventQuotePageDto,
  EventQuoteResponseDto,
  EventRequirementResponseDto,
  EventResponseDto,
  EventSpaceBookingResponseDto,
  PublicEventCatalogResponseDto,
  PublicEventRequestResponseDto,
} from './dto/event-response.dto.js';
import { EventsService } from './events.service.js';

/** Endpoints públicos y administrativos de eventos privados. */
@ApiTags('Eventos')
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get('catalog')
  @Public()
  @ApiOperation({ summary: 'Lista espacios y paquetes públicos de eventos' })
  @ApiResponse({ status: 200, type: PublicEventCatalogResponseDto })
  async catalog(
    @Query() query: PublicEventCatalogQueryDto,
  ): Promise<PublicEventCatalogResponseDto> {
    return this.service.getPublicCatalog(query.locationId);
  }

  @Post()
  @Public()
  @ApiOperation({ summary: 'Envía una solicitud pública de cotización de evento' })
  @ApiResponse({ status: 201, type: PublicEventRequestResponseDto })
  async createPublic(
    @Body() dto: CreatePublicEventRequestDto,
  ): Promise<PublicEventRequestResponseDto> {
    return this.service.createPublicEventRequest(dto);
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'Lista eventos con paginación y estado' })
  @ApiResponse({ status: 200, type: EventPageDto })
  async list(@Query() query: EventListQueryDto): Promise<EventPageDto> {
    return this.service.listEvents(query);
  }

  @Get('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un evento y sus espacios y requisitos' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  async get(@Param('id') id: string): Promise<EventResponseDto> {
    return this.service.getEvent(id);
  }

  @Post('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiOperation({ summary: 'Crea un evento administrativo' })
  @ApiResponse({ status: 201, type: EventResponseDto })
  async create(@Body() dto: CreateEventDto): Promise<EventResponseDto> {
    return this.service.createEvent(dto);
  }

  @Patch('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un evento' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto): Promise<EventResponseDto> {
    return this.service.updateEvent(id, dto);
  }

  @Delete('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Cancela lógicamente un evento' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  async delete(@Param('id') id: string): Promise<EventResponseDto> {
    return this.service.deleteEvent(id);
  }

  @Post('admin/:eventId/spaces')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiOperation({ summary: 'Reserva un espacio para un evento sin solapamiento' })
  @ApiResponse({ status: 201, type: EventSpaceBookingResponseDto })
  async bookSpace(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventSpaceBookingDto,
  ): Promise<EventSpaceBookingResponseDto> {
    return this.service.createSpaceBooking(eventId, dto);
  }

  @Delete('admin/bookings/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Libera lógicamente una reserva de espacio' })
  @ApiResponse({ status: 200, type: EventSpaceBookingResponseDto })
  async releaseSpace(@Param('id') id: string): Promise<EventSpaceBookingResponseDto> {
    return this.service.releaseSpaceBooking(id);
  }

  @Get('admin/packages')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'Lista paquetes administrativos con sus líneas' })
  @ApiResponse({ status: 200, type: [EventPackageResponseDto] })
  async listPackages(@Query() query: EventPackageListQueryDto): Promise<EventPackageResponseDto[]> {
    return this.service.listPackages(query.locationId, query.includeInactive);
  }

  @Get('admin/packages/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un paquete y sus líneas' })
  @ApiResponse({ status: 200, type: EventPackageResponseDto })
  async getPackage(@Param('id') id: string): Promise<EventPackageResponseDto> {
    return this.service.getPackage(id);
  }

  @Post('admin/packages')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiOperation({ summary: 'Crea un paquete con sus líneas en una transacción' })
  @ApiResponse({ status: 201, type: EventPackageResponseDto })
  async createPackage(@Body() dto: CreateEventPackageDto): Promise<EventPackageResponseDto> {
    return this.service.createPackage(dto);
  }

  @Patch('admin/packages/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un paquete y reemplaza sus líneas opcionalmente' })
  @ApiResponse({ status: 200, type: EventPackageResponseDto })
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdateEventPackageDto,
  ): Promise<EventPackageResponseDto> {
    return this.service.updatePackage(id, dto);
  }

  @Delete('admin/packages/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un paquete' })
  @ApiResponse({ status: 200, type: EventPackageResponseDto })
  async deletePackage(@Param('id') id: string): Promise<EventPackageResponseDto> {
    return this.service.deletePackage(id);
  }

  @Get('admin/:eventId/quotes')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.read')
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiOperation({ summary: 'Lista las versiones de cotización de un evento' })
  @ApiResponse({ status: 200, type: EventQuotePageDto })
  async listQuotes(@Param('eventId') eventId: string): Promise<EventQuotePageDto> {
    return this.service.listQuotes(eventId);
  }

  @Get('admin/quotes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una cotización y sus líneas calculadas' })
  @ApiResponse({ status: 200, type: EventQuoteResponseDto })
  async getQuote(@Param('id') id: string): Promise<EventQuoteResponseDto> {
    return this.service.getQuote(id);
  }

  @Post('admin/:eventId/quotes')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('event_quotes.manage')
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiOperation({ summary: 'Crea una nueva versión de cotización y calcula sus totales' })
  @ApiResponse({ status: 201, type: EventQuoteResponseDto })
  async createQuote(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventQuoteDto,
  ): Promise<EventQuoteResponseDto> {
    return this.service.createQuote(eventId, dto);
  }

  @Patch('admin/quotes/:id/status')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('event_quotes.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Cambia el estado de una cotización' })
  @ApiResponse({ status: 200, type: EventQuoteResponseDto })
  async updateQuoteStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventQuoteStatusDto,
  ): Promise<EventQuoteResponseDto> {
    return this.service.updateQuoteStatus(id, dto);
  }

  @Post('admin/:eventId/requirements')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiOperation({ summary: 'Agrega un requisito operativo al evento' })
  @ApiResponse({ status: 201, type: EventRequirementResponseDto })
  async createRequirement(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventRequirementDto,
  ): Promise<EventRequirementResponseDto> {
    return this.service.createRequirement(eventId, dto);
  }

  @Patch('admin/requirements/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza o resuelve un requisito' })
  @ApiResponse({ status: 200, type: EventRequirementResponseDto })
  async updateRequirement(
    @Param('id') id: string,
    @Body() dto: UpdateEventRequirementDto,
  ): Promise<EventRequirementResponseDto> {
    return this.service.updateRequirement(id, dto);
  }

  @Delete('admin/requirements/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('events.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Elimina un requisito no necesario' })
  @ApiResponse({ status: 204, description: 'Requisito eliminado.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRequirement(@Param('id') id: string): Promise<void> {
    return this.service.deleteRequirement(id);
  }
}
