# Estadísticas sin cookies

El módulo de analíticas registra visitas públicas como agregados diarios en
`page_views`. No almacena IP, cookies, identificadores de visitantes ni la URL
completa del referer: solo conserva el dominio normalizado.

## Captura pública

- `POST /analytics/page-view` acepta `path`, `locationId` opcional,
  `resourceType`, `resourceKey`, `referer` e `isPreview`.
- La respuesta es `204 No Content` y no contiene datos de la visita.
- Se descartan user-agents de bots, rutas `/preview` y eventos marcados como
  vista previa antes de consultar o escribir en la base.
- El límite público es de 120 solicitudes por minuto por origen de red mediante
  el throttler global. El IP se usa solo para limitar tráfico y nunca se guarda.

## Reportes administrativos

Todas las rutas requieren sesión, CSRF, `analytics.read` y alcance sobre la
sede solicitada:

- `GET /analytics/admin/locations`: sedes activas visibles para el usuario.
- `GET /analytics/admin/summary`: total y serie diaria.
- `GET /analytics/admin/pages`: visitas agrupadas por ruta pública.
- `GET /analytics/admin/products`: visitas agrupadas por plato o evento.
- `GET /analytics/admin/referrers`: visitas agrupadas por dominio o `Directo`.

Los filtros `locationId`, `from` y `to` usan fechas `YYYY-MM-DD`; el rango
máximo es de 366 días y se interpreta con la zona horaria de la sede. Las
filas con más de 395 días se eliminan de forma perezosa durante la captura.
La limpieza se puede repetir sin afectar los agregados vigentes.

## Privacidad y migración

La migración `20261015200000_analytics_page_views` es aditiva y crea índices
para fecha, sede, ruta, recurso y dominio. `aggregate_key` es un SHA-256
determinista de dimensiones no personales para incrementar la fila diaria sin
necesitar una clave compuesta con valores nulos. No es un hash de IP.
