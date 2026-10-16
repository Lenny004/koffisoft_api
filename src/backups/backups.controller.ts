import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { requestMetadata, type AuthenticatedRequest } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { BackupListQueryDto, CreateBackupDto } from './dto/backup.dto.js';
import { BackupResponseDto } from './dto/backup-response.dto.js';
import { BackupService } from './backups.service.js';

/** Expone el ciclo administrativo de respaldos sin aceptar rutas de archivos desde HTTP. */
@ApiTags('Respaldos')
@Controller('backups')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Post('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('backups.create')
  @ApiOperation({ summary: 'Inicia un respaldo manual' })
  @ApiResponse({ status: 201, type: BackupResponseDto })
  create(
    @Body() dto: CreateBackupDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BackupResponseDto> {
    return this.service.create(dto.type, this.actorId(request), requestMetadata(request));
  }

  @Get('admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('backups.read')
  @ApiOperation({ summary: 'Lista respaldos recientes y su estado' })
  @ApiResponse({ status: 200, type: [BackupResponseDto] })
  list(@Query() query: BackupListQueryDto): Promise<BackupResponseDto[]> {
    return this.service.list(query.type, query.limit);
  }

  @Get('admin/:id/download')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('backups.download')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Descarga un respaldo mediante stream autenticado' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.service.openDownload(
      id,
      this.actorId(request),
      requestMetadata(request),
    );
    reply
      .header('content-type', 'application/octet-stream')
      .header('content-disposition', `attachment; filename="${file.fileName}"`)
      .header('content-length', file.sizeBytes)
      .header('cache-control', 'private, no-store')
      .header('x-backup-sha256', file.checksum)
      .send(file.stream);
  }

  @Delete('admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('backups.delete')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Elimina el artefacto y lo marca como expirado' })
  @ApiResponse({ status: 200, type: BackupResponseDto })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BackupResponseDto> {
    return this.service.delete(id, this.actorId(request), requestMetadata(request));
  }

  private actorId(request: AuthenticatedRequest): string {
    if (!request.auth?.userId) {
      throw new UnauthorizedException('La ruta administrativa requiere una sesión autenticada.');
    }
    return request.auth.userId;
  }
}
