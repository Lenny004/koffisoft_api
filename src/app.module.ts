import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { ConfigModule } from './config/config.module.js';
import { ContactModule } from './contact/contact.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DomainEventsModule } from './domain-events/domain-events.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MailerModule } from './mailer/mailer.module.js';
import { MenuModule } from './menu/menu.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { SiteModule } from './site/site.module.js';
import { SeoModule } from './seo/seo.module.js';
import { UsersModule } from './users/users.module.js';
import { PublicationModule } from './publication/publication.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { BackupsModule } from './backups/backups.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    DomainEventsModule,
    MailerModule,
    AuthModule,
    ContactModule,
    HealthModule,
    InventoryModule,
    JobsModule,
    MenuModule,
    NotificationsModule,
    ReservationsModule,
    ResourcesModule,
    EventsModule,
    AnnouncementsModule,
    SiteModule,
    SeoModule,
    UsersModule,
    PublicationModule,
    AnalyticsModule,
    BackupsModule,
  ],
})
export class AppModule {}
