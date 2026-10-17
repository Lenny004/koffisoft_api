import { Controller, Get, Post, Query, Body, UseGuards, Req, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { MessageEvent } from '@nestjs/common';
import { Observable, map, takeUntil, fromEvent } from 'rxjs';

import { SessionGuard } from '../auth/guards/session.guard.js';
import { NotificationsService } from './notifications.service.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  NotificationListQueryDto,
  MarkNotificationAsReadDto,
  ArchiveNotificationDto,
} from './dto/notification.dto.js';
import {
  NotificationResponseDto,
  NotificationPageDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto.js';

/** Notificaciones del sistema con SSE en tiempo real. */
@ApiTags('notifications')
@Controller('notifications')
@UseGuards(SessionGuard)
@ApiBearerAuth('session')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario actual' })
  @ApiOkResponse({ type: NotificationPageDto })
  async listNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationPageDto> {
    const userId = req.auth?.userId;
    if (!userId) throw new Error('Usuario no autenticado');
    return this.service.listNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Obtener contador de notificaciones no leídas' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async getUnreadCount(@Req() req: AuthenticatedRequest): Promise<UnreadCountResponseDto> {
    const userId = req.auth?.userId;
    if (!userId) throw new Error('Usuario no autenticado');
    return this.service.getUnreadCount(userId);
  }

  @Post('mark-read')
  @ApiOperation({ summary: 'Marcar notificación(es) como leída(s)' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MarkNotificationAsReadDto,
  ): Promise<void> {
    const userId = req.auth?.userId;
    if (!userId) throw new Error('Usuario no autenticado');
    await this.service.markAsRead(userId, dto);
  }

  @Post('archive')
  @ApiOperation({ summary: 'Archivar una notificación' })
  async archiveNotification(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ArchiveNotificationDto,
  ): Promise<void> {
    const userId = req.auth?.userId;
    if (!userId) throw new Error('Usuario no autenticado');
    await this.service.archiveNotification(userId, dto);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Stream SSE de notificaciones en tiempo real' })
  sseStream(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const userId = req.auth?.userId;
    if (!userId) throw new Error('Usuario no autenticado');

    const stream = this.service.getNotificationStream(userId);
    const closeEvent = fromEvent(req.raw, 'close');

    return stream.pipe(
      takeUntil(closeEvent),
      map((notification: NotificationResponseDto) => ({
        data: notification,
      })),
    );
  }
}
