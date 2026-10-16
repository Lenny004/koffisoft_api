import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EventsModule } from '../events/events.module.js';
import { ReservationsModule } from '../reservations/reservations.module.js';
import { ContactController } from './contact.controller.js';
import { ContactRateLimitService } from './contact-rate-limit.service.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [AuthModule, ReservationsModule, EventsModule],
  controllers: [ContactController],
  providers: [ContactService, ContactRateLimitService],
})
export class ContactModule {}
