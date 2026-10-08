# Eventos privados y cotizaciones

El módulo `events` administra solicitudes de eventos privados, bloqueos de espacios, paquetes, cotizaciones versionadas y requisitos operativos. Usa las tablas reales `venue_spaces`, `events`, `event_space_bookings`, `event_packages`, `event_package_lines`, `event_quotes`, `event_quote_lines` y `event_requirements`.

## Reglas

- Las fechas de eventos y bloqueos administrativos son instantes ISO 8601 con offset explícito. La sede opera en `America/El_Salvador` (UTC-6).
- Una solicitud pública crea un `Event` con `status = inquiry` y `source = web`. No devuelve costos, UUID interno, notas, auditoría ni las líneas de paquetes.
- El catálogo público solo incluye espacios `active` con `allows_private_event = true` y paquetes `active`; los precios de paquetes no se publican.
- Un bloqueo usa el rango de montaje (`setup_starts_at` cuando existe) hasta desmontaje (`teardown_ends_at` cuando existe). Solo `held` y `confirmed` bloquean; la base aplica `event_space_bookings_no_overlap`.
- Las cotizaciones son versionadas por evento. Crear una cotización genera la siguiente versión y sus líneas en una transacción; las líneas se congelan con sus etiquetas e importes.
- Los importes se reciben como cadenas decimales y se calculan en el servidor con `Prisma.Decimal`: subtotal bruto, descuento, base imponible, impuesto y total. El cliente nunca envía los totales persistidos.
- Los paquetes se desactivan con `active = false`. Los requisitos no tienen columna de borrado lógico en el schema; `DELETE` se reserva para eliminar un requisito operativo y la resolución normal usa `status`/`resolvedAt`.

## Rutas públicas

No requieren sesión y están marcadas con `@Public()`.

- `GET /events/catalog?locationId={uuid}`: espacios y paquetes visibles, sin precios ni líneas internas.
- `POST /events`: envía una solicitud de cotización con contacto, tipo, título, intervalo, invitados, presupuesto opcional y requisitos especiales. Crea un evento en `inquiry`.

## Rutas administrativas

Las lecturas de eventos y catálogo usan `events.read`; las mutaciones operativas usan `events.manage`; la creación y cambio de estado de cotizaciones usa `event_quotes.manage`.

### Eventos

- `GET /events/admin`: listado paginado por sede y estado.
- `GET /events/admin/{id}`: detalle con bloqueos y requisitos.
- `POST /events/admin`: crea un evento administrativo.
- `PATCH /events/admin/{id}`: actualiza datos del evento y su estado.
- `DELETE /events/admin/{id}`: cancela lógicamente el evento (`status = cancelled`), porque el schema no tiene `active` ni un borrado físico seguro para sus relaciones.

### Bloqueos de espacios

- `POST /events/admin/{eventId}/spaces`: crea una reserva de espacio y rechaza solapamientos.
- `DELETE /events/admin/bookings/{id}`: marca el bloqueo como `released`.

### Paquetes y líneas

- `GET /events/admin/packages?locationId={uuid}&includeInactive=true`
- `GET /events/admin/packages/{id}`
- `POST /events/admin/packages`: crea el paquete y sus líneas en una transacción.
- `PATCH /events/admin/packages/{id}`: actualiza el paquete y, si se envían, reemplaza sus líneas en una transacción.
- `DELETE /events/admin/packages/{id}`: desactivación lógica.

### Cotizaciones y líneas

- `GET /events/admin/{eventId}/quotes`: lista versiones descendentes.
- `GET /events/admin/quotes/{id}`: detalle con líneas y totales calculados.
- `POST /events/admin/{eventId}/quotes`: crea una versión nueva con al menos una línea.
- `PATCH /events/admin/quotes/{id}/status`: cambia a un valor de `QuoteStatus`; el servidor registra `sentAt` o `acceptedAt` cuando corresponde y la base impide dos cotizaciones aceptadas para el mismo evento.

### Requisitos

- `POST /events/admin/{eventId}/requirements`
- `PATCH /events/admin/requirements/{id}`
- `DELETE /events/admin/requirements/{id}`

## Tablas y verificaciones

El módulo consulta o escribe `locations`, `venue_spaces`, `events`, `event_space_bookings`, `event_packages`, `event_package_lines`, `event_quotes`, `event_quote_lines` y `event_requirements`. Las referencias opcionales a `customers`, `users` y `menu_item_variants` se validan mediante las relaciones de Prisma y no crean tablas nuevas.

Las pruebas unitarias cubren totales exactos y validaciones de intervalos; el test HTTP usa `Fastify.inject` y se omite cuando falta `TEST_DATABASE_URL`.
