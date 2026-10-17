import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationSeverity, NotificationType } from '../generated/prisma/enums.js';
import type {
  LowStockDetectedEvent,
  LotExpiringEvent,
  ReservationCreatedEvent,
  ContactMessageReceivedEvent,
  BackupCompletedEvent,
  BackupFailedEvent,
  ResourceMaintenanceDueEvent,
  SupplierReminderDueEvent,
} from '../domain-events/events/index.js';
import type {
  NotificationListQueryDto,
  MarkNotificationAsReadDto,
  ArchiveNotificationDto,
} from './dto/notification.dto.js';
import type {
  NotificationResponseDto,
  NotificationPageDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto.js';

/** Gestiona notificaciones del sistema y alertas operativas con SSE. */
@Injectable()
export class NotificationsService {
  private readonly notificationStreams = new Map<string, Subject<NotificationResponseDto>>();

  constructor(private readonly prisma: PrismaService) {}

  async listNotifications(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<NotificationPageDto> {
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      ...(query.notificationType ? { notificationType: query.notificationType } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.includeArchived ? {} : { archived: false }),
    };

    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.prisma.notification.count({
      where: { recipientUserId: userId, readAt: null, archived: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, dto: MarkNotificationAsReadDto): Promise<void> {
    if (dto.notificationId) {
      await this.prisma.notification.updateMany({
        where: { id: dto.notificationId, recipientUserId: userId },
        data: { readAt: new Date() },
      });
    } else {
      await this.prisma.notification.updateMany({
        where: { recipientUserId: userId, readAt: null },
        data: { readAt: new Date() },
      });
    }
  }

  async archiveNotification(userId: string, dto: ArchiveNotificationDto): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: dto.notificationId, recipientUserId: userId },
      data: { archived: true },
    });
  }

  getNotificationStream(userId: string): Subject<NotificationResponseDto> {
    if (!this.notificationStreams.has(userId)) {
      this.notificationStreams.set(userId, new Subject<NotificationResponseDto>());
    }
    return this.notificationStreams.get(userId)!;
  }

  @OnEvent('inventory.low-stock')
  async handleLowStock(event: LowStockDetectedEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.LowStock,
        severity: NotificationSeverity.Warning,
        title: 'Stock bajo detectado',
        body: `El ingrediente "${event.ingredientName}" (${event.sku}) está por debajo del nivel de reorden. Stock actual: ${event.currentStock} ${event.baseUnitCode}, nivel de reorden: ${event.reorderLevel} ${event.baseUnitCode}.`,
        internalLink: `/admin/inventory/ingredients/${event.ingredientId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('inventory.lot-expiring')
  async handleLotExpiring(event: LotExpiringEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.LotExpiring,
        severity: NotificationSeverity.Warning,
        title: 'Lote por vencer',
        body: `El lote ${event.lotCode} de "${event.ingredientName}" vence el ${event.expiresOn} (en ${event.daysUntilExpiry} días). Stock remanente: ${event.remainingStock}.`,
        internalLink: `/admin/inventory/lots/${event.inventoryLotId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('reservation.created')
  async handleReservationCreated(event: ReservationCreatedEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.ReservationNew,
        severity: NotificationSeverity.Info,
        title: 'Nueva reserva recibida',
        body: `${event.customerName} solicitó una reserva para ${event.partySize} personas el ${event.reservationDate} a las ${event.reservationTime}.`,
        internalLink: `/admin/reservations/${event.reservationId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('contact.message-received')
  async handleContactMessage(event: ContactMessageReceivedEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.ContactMessage,
        severity: NotificationSeverity.Info,
        title: 'Nuevo mensaje de contacto',
        body: `${event.name} (${event.email}) envió un mensaje: "${event.subject}".`,
        internalLink: `/admin/contact/${event.messageId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('backup.completed')
  async handleBackupCompleted(event: BackupCompletedEvent): Promise<void> {
    const sizeMB = (Number(event.sizeBytes) / (1024 * 1024)).toFixed(2);
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.BackupSuccess,
        severity: NotificationSeverity.Success,
        title: 'Respaldo completado',
        body: `Respaldo ${event.type} completado exitosamente (${sizeMB} MB) en ${event.durationMs}ms.`,
        internalLink: `/admin/backups/${event.backupJobId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('backup.failed')
  async handleBackupFailed(event: BackupFailedEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.BackupFailed,
        severity: NotificationSeverity.Error,
        title: 'Respaldo fallido',
        body: `El respaldo ${event.type} falló: ${event.error}.`,
        internalLink: `/admin/backups/${event.backupJobId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('resource.maintenance-due')
  async handleMaintenanceDue(event: ResourceMaintenanceDueEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.MaintenanceDue,
        severity: NotificationSeverity.Info,
        title: 'Mantenimiento pendiente',
        body: `El recurso "${event.resourceName}" (${event.resourceCode}) tiene un mantenimiento programado para ${event.scheduledDate} (en ${event.daysUntilDue} días).`,
        internalLink: `/admin/resources/${event.resourceId}/maintenance/${event.maintenanceScheduleId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  @OnEvent('supplier.reminder-due')
  async handleSupplierReminder(event: SupplierReminderDueEvent): Promise<void> {
    const typeText = event.reminderType === 'delivery' ? 'entrega' : 'pedido';
    const notification = await this.prisma.notification.create({
      data: {
        notificationType: NotificationType.SupplierReminder,
        severity: NotificationSeverity.Info,
        title: `Recordatorio de ${typeText}`,
        body: `Recordatorio de ${typeText} para el proveedor "${event.supplierName}" programado para ${event.dueDate}.`,
        internalLink: `/admin/suppliers/${event.supplierId}`,
        recipientRoleCode: 'admin',
      },
    });
    await this.broadcastToRole('admin', this.toResponse(notification));
  }

  private async broadcastToRole(
    roleCode: string,
    notification: NotificationResponseDto,
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: { code: roleCode } } },
        status: 'Active',
      },
      select: { id: true },
    });

    for (const user of users) {
      const stream = this.notificationStreams.get(user.id);
      if (stream) {
        stream.next(notification);
      }
    }
  }

  private toResponse(
    row: Prisma.NotificationGetPayload<Record<string, never>>,
  ): NotificationResponseDto {
    return {
      id: row.id,
      notificationType: row.notificationType,
      severity: row.severity,
      title: row.title,
      body: row.body,
      internalLink: row.internalLink,
      readAt: row.readAt?.toISOString() ?? null,
      archived: row.archived,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
