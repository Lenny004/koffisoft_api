import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { SiteController } from './site.controller.js';
import { SiteService } from './site.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
