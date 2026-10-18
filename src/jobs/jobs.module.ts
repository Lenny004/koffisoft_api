import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseModule } from '../database/database.module.js';
import { AlertsScheduler } from './alerts.scheduler.js';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  providers: [AlertsScheduler],
})
export class JobsModule {}
