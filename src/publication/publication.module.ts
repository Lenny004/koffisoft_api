import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PublicationController } from './publication.controller.js';
import { PublicationScheduler } from './publication.scheduler.js';
import { PublicationService } from './publication.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PublicationController],
  providers: [PublicationService, PublicationScheduler],
  exports: [PublicationService],
})
export class PublicationModule {}
