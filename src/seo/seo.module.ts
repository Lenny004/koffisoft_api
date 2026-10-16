import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SeoController, SeoFeedController } from './seo.controller.js';
import { SeoService } from './seo.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SeoController, SeoFeedController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
