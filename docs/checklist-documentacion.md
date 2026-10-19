# Checklist documentación (funciones y métodos)

Auditoría: `node scripts/audit-docs.mjs` y `node scripts/generate-checklist.mjs`.
Criterio: bloque `/**` en español inmediatamente encima de cada declaración de función o método.

## Leyenda

| Símbolo | Significado |
| --- | --- |
| [x] | Todas las funciones detectadas documentadas |
| [~] | Parcial |
| [ ] | Pendiente |
| [-] | Sin funciones declaradas |

## Resumen

| Métrica | Cantidad |
| --- | ---: |
| files | 135 |
| completo | 52 |
| parcial | 0 |
| pendiente | 0 |
| sinFunciones | 83 |

## Archivos

| | Archivo | Funciones | Doc |
| --- | --- | ---: | ---: |
| [-] | `src/analytics/analytics.controller.ts` | — | — |
| [-] | `src/analytics/analytics.module.ts` | — | — |
| [x] | `src/analytics/analytics.service.ts` | 15 | 15 |
| [-] | `src/analytics/dto/analytics-response.dto.ts` | — | — |
| [x] | `src/analytics/dto/analytics.dto.ts` | 2 | 2 |
| [-] | `src/announcements/announcements.controller.ts` | — | — |
| [-] | `src/announcements/announcements.module.ts` | — | — |
| [x] | `src/announcements/announcements.service.ts` | 5 | 5 |
| [-] | `src/announcements/dto/announcement-response.dto.ts` | — | — |
| [x] | `src/announcements/dto/announcement.dto.ts` | 2 | 2 |
| [-] | `src/app.module.ts` | — | — |
| [-] | `src/auth/audit-log.controller.ts` | — | — |
| [x] | `src/auth/auth.controller.ts` | 1 | 1 |
| [-] | `src/auth/auth.module.ts` | — | — |
| [x] | `src/auth/auth.service.ts` | 7 | 7 |
| [x] | `src/auth/auth.types.ts` | 1 | 1 |
| [x] | `src/auth/decorators/auth-flow.decorator.ts` | 3 | 3 |
| [x] | `src/auth/decorators/permissions.decorator.ts` | 1 | 1 |
| [x] | `src/auth/decorators/public.decorator.ts` | 1 | 1 |
| [-] | `src/auth/dto/audit-log.dto.ts` | — | — |
| [-] | `src/auth/dto/auth-response.dto.ts` | — | — |
| [-] | `src/auth/dto/login.dto.ts` | — | — |
| [-] | `src/auth/dto/mfa.dto.ts` | — | — |
| [-] | `src/auth/dto/password-reset.dto.ts` | — | — |
| [-] | `src/auth/dto/password.dto.ts` | — | — |
| [-] | `src/auth/dto/setup.dto.ts` | — | — |
| [-] | `src/auth/fastify.d.ts` | — | — |
| [x] | `src/auth/guards/csrf.guard.ts` | 2 | 2 |
| [x] | `src/auth/guards/permission.guard.ts` | 1 | 1 |
| [x] | `src/auth/guards/session.guard.ts` | 1 | 1 |
| [x] | `src/auth/security/access-scope.service.ts` | 2 | 2 |
| [-] | `src/auth/security/audit.service.ts` | — | — |
| [x] | `src/auth/security/mfa-crypto.service.ts` | 2 | 2 |
| [x] | `src/auth/security/password.service.ts` | 5 | 5 |
| [x] | `src/auth/security/session.service.ts` | 5 | 5 |
| [x] | `src/auth/security/totp.service.ts` | 2 | 2 |
| [-] | `src/backups/backup-process.runner.ts` | — | — |
| [-] | `src/backups/backups.controller.ts` | — | — |
| [-] | `src/backups/backups.module.ts` | — | — |
| [x] | `src/backups/backups.scheduler.ts` | 2 | 2 |
| [x] | `src/backups/backups.service.ts` | 8 | 8 |
| [-] | `src/backups/dto/backup-response.dto.ts` | — | — |
| [-] | `src/backups/dto/backup.dto.ts` | — | — |
| [x] | `src/bootstrap.ts` | 3 | 3 |
| [-] | `src/common/http-exception.filter.ts` | — | — |
| [x] | `src/config/app-config.ts` | 12 | 12 |
| [-] | `src/config/config.module.ts` | — | — |
| [-] | `src/contact/contact-rate-limit.service.ts` | — | — |
| [-] | `src/contact/contact.controller.ts` | — | — |
| [-] | `src/contact/contact.module.ts` | — | — |
| [x] | `src/contact/contact.service.ts` | 2 | 2 |
| [-] | `src/contact/dto/contact-response.dto.ts` | — | — |
| [x] | `src/contact/dto/contact.dto.ts` | 3 | 3 |
| [-] | `src/database/database.module.ts` | — | — |
| [x] | `src/database/prisma.service.ts` | 2 | 2 |
| [-] | `src/domain-events/domain-events.module.ts` | — | — |
| [-] | `src/domain-events/events/backup.events.ts` | — | — |
| [-] | `src/domain-events/events/contact.events.ts` | — | — |
| [-] | `src/domain-events/events/index.ts` | — | — |
| [-] | `src/domain-events/events/inventory.events.ts` | — | — |
| [-] | `src/domain-events/events/purchase-order.events.ts` | — | — |
| [-] | `src/domain-events/events/reservation.events.ts` | — | — |
| [-] | `src/domain-events/events/resource.events.ts` | — | — |
| [-] | `src/domain-events/events/security.events.ts` | — | — |
| [-] | `src/events/dto/event-response.dto.ts` | — | — |
| [x] | `src/events/dto/event.dto.ts` | 3 | 3 |
| [-] | `src/events/events.controller.ts` | — | — |
| [-] | `src/events/events.module.ts` | — | — |
| [x] | `src/events/events.service.ts` | 25 | 25 |
| [x] | `src/health/health.controller.ts` | 1 | 1 |
| [-] | `src/health/health.module.ts` | — | — |
| [-] | `src/inventory/dto/inventory-response.dto.ts` | — | — |
| [x] | `src/inventory/dto/inventory.dto.ts` | 2 | 2 |
| [-] | `src/inventory/dto/purchase-order-response.dto.ts` | — | — |
| [-] | `src/inventory/dto/purchase-order.dto.ts` | — | — |
| [x] | `src/inventory/inventory.controller.ts` | 2 | 2 |
| [-] | `src/inventory/inventory.module.ts` | — | — |
| [x] | `src/inventory/inventory.service.ts` | 23 | 23 |
| [-] | `src/inventory/purchase-orders.controller.ts` | — | — |
| [x] | `src/inventory/purchase-orders.service.ts` | 8 | 8 |
| [x] | `src/jobs/alerts.scheduler.ts` | 5 | 5 |
| [-] | `src/jobs/jobs.module.ts` | — | — |
| [x] | `src/mailer/console-mailer.service.ts` | 2 | 2 |
| [-] | `src/mailer/mailer.module.ts` | — | — |
| [-] | `src/mailer/mailer.service.ts` | — | — |
| [x] | `src/mailer/smtp-mailer.service.ts` | 2 | 2 |
| [x] | `src/main.ts` | 1 | 1 |
| [-] | `src/menu/dto/allergen.dto.ts` | — | — |
| [-] | `src/menu/dto/availability.dto.ts` | — | — |
| [-] | `src/menu/dto/category.dto.ts` | — | — |
| [-] | `src/menu/dto/item.dto.ts` | — | — |
| [x] | `src/menu/dto/menu-query.dto.ts` | 2 | 2 |
| [-] | `src/menu/dto/menu-response.dto.ts` | — | — |
| [-] | `src/menu/dto/modifier.dto.ts` | — | — |
| [-] | `src/menu/dto/price.dto.ts` | — | — |
| [-] | `src/menu/dto/variant.dto.ts` | — | — |
| [-] | `src/menu/menu.controller.ts` | — | — |
| [-] | `src/menu/menu.module.ts` | — | — |
| [x] | `src/menu/menu.service.ts` | 40 | 40 |
| [-] | `src/notifications/dto/notification-response.dto.ts` | — | — |
| [-] | `src/notifications/dto/notification.dto.ts` | — | — |
| [-] | `src/notifications/notifications.controller.ts` | — | — |
| [-] | `src/notifications/notifications.module.ts` | — | — |
| [x] | `src/notifications/notifications.service.ts` | 12 | 12 |
| [-] | `src/publication/dto/publication-response.dto.ts` | — | — |
| [x] | `src/publication/dto/publication.dto.ts` | 1 | 1 |
| [-] | `src/publication/publication.controller.ts` | — | — |
| [-] | `src/publication/publication.module.ts` | — | — |
| [x] | `src/publication/publication.scheduler.ts` | 2 | 2 |
| [x] | `src/publication/publication.service.ts` | 2 | 2 |
| [-] | `src/reservations/dto/reservation-response.dto.ts` | — | — |
| [x] | `src/reservations/dto/reservation.dto.ts` | 2 | 2 |
| [-] | `src/reservations/reservations.controller.ts` | — | — |
| [-] | `src/reservations/reservations.module.ts` | — | — |
| [x] | `src/reservations/reservations.service.ts` | 16 | 16 |
| [-] | `src/resources/dto/resource-response.dto.ts` | — | — |
| [-] | `src/resources/dto/resource.dto.ts` | — | — |
| [-] | `src/resources/resources.controller.ts` | — | — |
| [-] | `src/resources/resources.module.ts` | — | — |
| [x] | `src/resources/resources.service.ts` | 3 | 3 |
| [-] | `src/seo/dto/seo-response.dto.ts` | — | — |
| [x] | `src/seo/dto/seo.dto.ts` | 1 | 1 |
| [x] | `src/seo/seo.controller.ts` | 2 | 2 |
| [-] | `src/seo/seo.module.ts` | — | — |
| [x] | `src/seo/seo.service.ts` | 13 | 13 |
| [-] | `src/site/dto/site-response.dto.ts` | — | — |
| [x] | `src/site/dto/site.dto.ts` | 2 | 2 |
| [-] | `src/site/site.controller.ts` | — | — |
| [-] | `src/site/site.module.ts` | — | — |
| [x] | `src/site/site.service.ts` | 6 | 6 |
| [-] | `src/users/dto/users-response.dto.ts` | — | — |
| [x] | `src/users/dto/users.dto.ts` | 2 | 2 |
| [-] | `src/users/users.controller.ts` | — | — |
| [-] | `src/users/users.module.ts` | — | — |
| [x] | `src/users/users.service.ts` | 6 | 6 |