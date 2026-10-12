import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MenuModule } from './menu/menu.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    InventoryModule,
    MenuModule,
    ReservationsModule,
    EventsModule,
    AnnouncementsModule,
    UsersModule,
  ],
})
export class AppModule {}
