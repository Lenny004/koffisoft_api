import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BackupController } from './backups.controller.js';
import { BackupProcessRunner } from './backup-process.runner.js';
import { BackupScheduler } from './backups.scheduler.js';
import { BackupService } from './backups.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BackupController],
  providers: [BackupProcessRunner, BackupScheduler, BackupService],
})
export class BackupsModule {}
