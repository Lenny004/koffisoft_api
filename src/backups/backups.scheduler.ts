import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { BackupService } from './backups.service.js';

/** Programa respaldos completos y retención en el mismo proceso, sin requerir Docker. */
@Injectable()
export class BackupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly backupService: BackupService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Inicia el ciclo programado de respaldos y retención cuando está habilitado.
   */
  onModuleInit(): void {
    if (!this.config.backupsEnabled || this.config.backupScheduleMinutes <= 0) return;
    const interval = this.config.backupScheduleMinutes * 60_000;
    this.timer = setInterval(() => void this.process(), interval);
    void this.process();
  }

  /**
   * Cancela el temporizador de respaldos al apagar la aplicación.
   */
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async process(): Promise<void> {
    try {
      await this.backupService.cleanupExpired();
      await this.backupService.runScheduled();
    } catch (error) {
      this.logger.error('No se pudo ejecutar el ciclo programado de respaldos.', error);
    }
  }
}
