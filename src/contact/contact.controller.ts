import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { requestMetadata, type AuthenticatedRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AccessScopeService } from '../auth/security/access-scope.service.js';
import {
  ContactMessageListQueryDto,
  ConvertContactToEventDto,
  ConvertContactToReservationDto,
  CreatePublicContactMessageDto,
  UpdateContactMessageDto,
} from './dto/contact.dto.js';
import {
  ContactConversionResponseDto,
  ContactMessagePageDto,
  ContactMessageResponseDto,
  PublicContactMessageResponseDto,
} from './dto/contact-response.dto.js';
import { ContactService } from './contact.service.js';

/** Recibe mensajes públicos y expone la bandeja protegida por sede. */
@ApiTags('Contacto')
@Controller('contact')
export class ContactController {
  constructor(
    private readonly service: ContactService,
    private readonly scope: AccessScopeService,
  ) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Recibe un mensaje público de contacto' })
  @ApiResponse({ status: 201, type: PublicContactMessageResponseDto })
  createPublic(
    @Body() dto: CreatePublicContactMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicContactMessageResponseDto> {
    return this.service.createPublic(dto, request.ip);
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('contact.read')
  @ApiOperation({ summary: 'Lista mensajes de contacto por sede' })
  @ApiResponse({ status: 200, type: ContactMessagePageDto })
  async list(
    @Query() query: ContactMessageListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactMessagePageDto> {
    await this.assertScope(request, query.locationId);
    return this.service.list(query);
  }

  @Get('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('contact.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un mensaje y su auditoría' })
  @ApiResponse({ status: 200, type: ContactMessageResponseDto })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactMessageResponseDto> {
    await this.assertScope(request, locationId);
    return this.service.get(id, locationId);
  }

  @Patch('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('contact.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza estado, asignación o archivado' })
  @ApiResponse({ status: 200, type: ContactMessageResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateContactMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactMessageResponseDto> {
    await this.assertScope(request, locationId);
    return this.service.update(
      id,
      locationId,
      dto,
      this.actorId(request),
      requestMetadata(request),
    );
  }

  @Post('admin/:id/customer')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('contact.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Convierte el mensaje en cliente' })
  @ApiResponse({ status: 201, type: ContactConversionResponseDto })
  async convertCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactConversionResponseDto> {
    await this.assertScope(request, locationId);
    return this.service.convertToCustomer(
      id,
      locationId,
      this.actorId(request),
      requestMetadata(request),
    );
  }

  @Post('admin/:id/reservation')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('contact.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Convierte el mensaje en reserva' })
  @ApiResponse({ status: 201, type: ContactConversionResponseDto })
  async convertReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: ConvertContactToReservationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactConversionResponseDto> {
    await this.assertScope(request, locationId);
    return this.service.convertToReservation(
      id,
      locationId,
      dto,
      this.actorId(request),
      requestMetadata(request),
    );
  }

  @Post('admin/:id/event')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('contact.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Convierte el mensaje en evento' })
  @ApiResponse({ status: 201, type: ContactConversionResponseDto })
  async convertEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: ConvertContactToEventDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactConversionResponseDto> {
    await this.assertScope(request, locationId);
    return this.service.convertToEvent(
      id,
      locationId,
      dto,
      this.actorId(request),
      requestMetadata(request),
    );
  }

  private async assertScope(request: AuthenticatedRequest, locationId: string): Promise<void> {
    await this.scope.assertLocationAccess(this.actorId(request), locationId);
  }

  private actorId(request: AuthenticatedRequest): string {
    return request.auth?.userId ?? '';
  }
}
