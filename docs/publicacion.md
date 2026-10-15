# Publicacion editorial

El modulo `publication` coordina el estado editorial de avisos, eventos y
platos sin duplicar esos recursos. La migracion es aditiva y conserva los
datos existentes como publicados cuando ya estaban activos y visibles.

## Estados y fechas

- `Draft`: contenido guardado pero no visible en la web.
- `Scheduled`: espera `scheduledAt`; el planificador lo publica al llegar la
  fecha.
- `Published`: visible si `publishedAt` ya llego y `expiresAt` no ha vencido.

Todas las fechas se persisten como instantes ISO. La interfaz editorial las
presenta en `America/El_Salvador`, la zona horaria predeterminada de las sedes.
La expiracion es opcional y siempre debe ser posterior a la publicacion.

## Rutas

- `GET /publication/admin/context?locationId=...`: zona horaria editorial.
- `POST /publication/admin/:resourceType/:id`: cambia a borrador, programa,
  publica o despublica; requiere `content.publish` y lectura/gestion del
  recurso.
- `POST /publication/admin/:resourceType/:id/preview`: emite un token opaco
  aleatorio de 15 minutos; requiere `content.publish` y lectura del recurso.
- `GET /publication/preview/:token`: consume el token una sola vez, devuelve
  solo campos publicos y responde con `X-Robots-Tag: noindex` y sin cache.

El permiso `content.publish` se asigna por seed a `owner`, `admin` y
`manager`. Los cambios manuales y automaticos dejan registros en `AuditLog`.

## Vigencia publica

Los endpoints publicos de avisos, carta y eventos exigen estado `Published`,
fecha de publicacion vencida y fecha de expiracion futura o nula. SEO y
`sitemap.xml` aplican exactamente los mismos filtros. Un proceso interno
idempotente revisa cada minuto publicaciones programadas y expiradas.

## Verificacion

```bash
pnpm prisma:generate
pnpm prisma:validate
pnpm lint
pnpm typecheck
pnpm test
```
