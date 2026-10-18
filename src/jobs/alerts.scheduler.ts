import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  LowStockDetectedEvent,
  LotExpiringEvent,
  SupplierReminderDueEvent,
  ResourceMaintenanceDueEvent,
} from '../domain-events/events/index.js';

/** Scheduler de alertas de inventario, proveedores, recursos y limpieza de notificaciones. */
@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);
  private readonly expiryDaysThreshold = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Ejecuta cada hora: detecta stock bajo sin duplicar alertas. */
  @Cron(CronExpression.EVERY_HOUR)
  async checkLowStock(): Promise<void> {
    this.logger.log('Ejecutando verificación de stock bajo...');

    const ingredients = await this.prisma.ingredient.findMany({
      where: { active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        reorderLevel: true,
        baseUnit: { select: { code: true } },
      },
    });

    const locationIds = await this.prisma.location.findMany({
      where: { active: true },
      select: { id: true },
    });

    for (const location of locationIds) {
      for (const ingredient of ingredients) {
        const stock = await this.getStock(location.id, ingredient.id);

        if (stock.lte(ingredient.reorderLevel)) {
          const hasAlert = await this.hasRecentNotification(
            location.id,
            'low_stock',
            ingredient.id,
          );

          if (!hasAlert) {
            const event: LowStockDetectedEvent = {
              ingredientId: ingredient.id,
              ingredientName: ingredient.name,
              sku: ingredient.sku,
              locationId: location.id,
              currentStock: stock.toString(),
              reorderLevel: ingredient.reorderLevel.toString(),
              baseUnitCode: ingredient.baseUnit.code,
            };

            this.eventEmitter.emit('inventory.low-stock', event);
            this.logger.log(
              `Alerta de stock bajo emitida: ${ingredient.name} en sede ${location.id}`,
            );
          }
        }
      }
    }
  }

  /** Ejecuta diariamente: detecta lotes por vencer sin duplicar alertas. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkExpiringLots(): Promise<void> {
    this.logger.log('Ejecutando verificación de lotes por vencer...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const until = new Date(today);
    until.setDate(until.getDate() + this.expiryDaysThreshold);

    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        active: true,
        expiresOn: { gte: today, lte: until },
        storageLocation: { active: true },
      },
      include: {
        ingredient: { select: { id: true, name: true } },
        storageLocation: { select: { id: true, code: true, locationId: true } },
      },
    });

    for (const lot of lots) {
      const stock = await this.getLotStock(lot.id);

      if (stock.gt(0)) {
        const hasAlert = await this.hasRecentNotification(
          lot.storageLocation.locationId,
          'lot_expiring',
          lot.id,
        );

        if (!hasAlert) {
          const daysUntilExpiry = Math.ceil(
            (lot.expiresOn!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          const event: LotExpiringEvent = {
            inventoryLotId: lot.id,
            ingredientId: lot.ingredient.id,
            ingredientName: lot.ingredient.name,
            lotCode: lot.lotCode,
            storageLocationId: lot.storageLocation.id,
            storageLocationCode: lot.storageLocation.code,
            locationId: lot.storageLocation.locationId,
            remainingStock: stock.toString(),
            expiresOn: lot.expiresOn!.toISOString().slice(0, 10),
            daysUntilExpiry,
          };

          this.eventEmitter.emit('inventory.lot-expiring', event);
          this.logger.log(`Alerta de lote por vencer emitida: ${lot.lotCode}`);
        }
      }
    }
  }

  /** Ejecuta diariamente: recordatorios de pedido a proveedores. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkSupplierReminders(): Promise<void> {
    this.logger.log('Ejecutando verificación de recordatorios de proveedores...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        active: true,
        OR: [{ orderReminderDays: { not: null } }, { deliveryDays: { not: null } }],
      },
    });

    for (const supplier of suppliers) {
      if (supplier.orderReminderDays && supplier.lastOrderDate) {
        const daysSinceLastOrder = Math.floor(
          (today.getTime() - supplier.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceLastOrder >= supplier.orderReminderDays) {
          const hasAlert = await this.hasRecentNotification(
            supplier.locationId,
            'supplier_reminder',
            supplier.id,
          );

          if (!hasAlert) {
            const event: SupplierReminderDueEvent = {
              supplierId: supplier.id,
              supplierName: supplier.name,
              locationId: supplier.locationId,
              reminderType: 'order',
              dueDate: today.toISOString().slice(0, 10),
            };

            this.eventEmitter.emit('supplier.reminder-due', event);
            this.logger.log(`Recordatorio de pedido emitido para proveedor: ${supplier.name}`);
          }
        }
      }
    }
  }

  /** Ejecuta diariamente: recordatorios de mantenimientos pendientes. */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async checkMaintenanceDue(): Promise<void> {
    this.logger.log('Ejecutando verificación de mantenimientos pendientes...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = new Date(today);
    upcoming.setDate(upcoming.getDate() + 3);

    const schedules = await this.prisma.resourceMaintenanceSchedule.findMany({
      where: {
        completed: false,
        scheduledDate: { gte: today, lte: upcoming },
        resource: { active: true },
      },
      include: {
        resource: {
          select: {
            id: true,
            resourceCode: true,
            name: true,
            locationId: true,
          },
        },
      },
    });

    for (const schedule of schedules) {
      const hasAlert = await this.hasRecentNotification(
        schedule.resource.locationId,
        'maintenance_due',
        schedule.id,
      );

      if (!hasAlert) {
        const daysUntilDue = Math.ceil(
          (schedule.scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const event: ResourceMaintenanceDueEvent = {
          resourceId: schedule.resource.id,
          resourceName: schedule.resource.name,
          resourceCode: schedule.resource.resourceCode,
          locationId: schedule.resource.locationId,
          maintenanceScheduleId: schedule.id,
          scheduledDate: schedule.scheduledDate.toISOString().slice(0, 10),
          daysUntilDue,
        };

        this.eventEmitter.emit('resource.maintenance-due', event);
        this.logger.log(
          `Recordatorio de mantenimiento emitido para recurso: ${schedule.resource.name}`,
        );
      }
    }
  }

  /** Ejecuta diariamente: limpia notificaciones leídas y archivadas antiguas. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupNotifications(): Promise<void> {
    this.logger.log('Ejecutando limpieza de notificaciones antiguas...');

    const retentionDays = 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        archived: true,
        createdAt: { lt: cutoff },
      },
    });

    this.logger.log(`Eliminadas ${result.count} notificaciones antiguas`);
  }

  private async getStock(locationId: string, ingredientId: string): Promise<Prisma.Decimal> {
    const result = await this.prisma.inventoryMovement.aggregate({
      where: {
        ingredientId,
        storageLocation: { locationId },
      },
      _sum: { quantityDelta: true },
    });

    return result._sum.quantityDelta ?? new Prisma.Decimal(0);
  }

  private async getLotStock(inventoryLotId: string): Promise<Prisma.Decimal> {
    const result = await this.prisma.inventoryMovement.aggregate({
      where: { inventoryLotId },
      _sum: { quantityDelta: true },
    });

    return result._sum.quantityDelta ?? new Prisma.Decimal(0);
  }

  private async hasRecentNotification(
    _locationId: string,
    type: string,
    entityId: string,
  ): Promise<boolean> {
    const recentWindow = new Date();
    recentWindow.setHours(recentWindow.getHours() - 24);

    const count = await this.prisma.notification.count({
      where: {
        notificationType: type as any,
        internalLink: { contains: entityId },
        createdAt: { gte: recentWindow },
      },
    });

    return count > 0;
  }
}
