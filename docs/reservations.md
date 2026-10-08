# Reservas, espacios y mesas

El módulo `reservations` administra solicitudes de reserva de mesa y los recursos físicos de una sede. Usa las tablas `venue_spaces`, `dining_tables`, `reservations` y `reservation_tables`; no agrega columnas ni cambia el schema.

## Reglas

- Las rutas públicas reciben `date` y `time` en `America/El_Salvador` (UTC-6) y convierten el intervalo a instantes UTC para persistirlo.
- Una solicitud pública se crea con `status = requested` y `source = web`. La respuesta pública no incluye el UUID, contacto, auditoría, notas internas ni costos.
- La disponibilidad exige espacio activo que admita reservas, capacidad suficiente en mesas libres y ausencia de un bloqueo de evento activo.
- Las mesas se consideran ocupadas solo cuando `reservation_tables.allocation_status` es `held` o `assigned` y el intervalo se cruza. La base también aplica `reservation_tables_no_overlap` mediante `EXCLUDE`.
- Completar, cancelar o marcar `no_show` libera las asignaciones de mesa dentro de la misma transacción que cambia la reserva.
- Las eliminaciones administrativas de espacios y mesas son lógicas mediante `active = false`.
- El throttling global existente de Nest limita las solicitudes HTTP a 100 por minuto por proceso. No se agregó otra dependencia.

## Rutas públicas

No requieren sesión y están marcadas con `@Public()`.

- `GET /reservations/availability`: recibe `locationId`, `date` (`YYYY-MM-DD`), `time` (`HH:mm`), `partySize`, `durationMinutes` opcional y `spaceId` opcional. Devuelve espacios y disponibilidad sin mesas internas.
- `POST /reservations`: recibe contacto, sede, fecha/hora local, grupo, espacio preferido opcional y solicitudes especiales. Crea la solicitud pendiente (`requested`).

## Rutas administrativas

Las lecturas usan `reservations.read`; las mutaciones usan `reservations.manage`.

### Reservas

- `GET /reservations/admin`: listado paginado por `locationId`, rango de fechas, `status` y `spaceId`.
- `GET /reservations/admin/{id}`: detalle con contacto snapshot, notas internas y mesas asignadas.
- `POST /reservations/admin/{id}/confirm`: `requested` o `pending_confirmation` → `confirmed`.
- `POST /reservations/admin/{id}/seat`: `confirmed` → `seated`.
- `POST /reservations/admin/{id}/complete`: `seated` → `completed`.
- `POST /reservations/admin/{id}/cancel`: cancela desde estados abiertos y libera mesas.
- `POST /reservations/admin/{id}/no-show`: `confirmed` → `no_show` y libera mesas.
- `PUT /reservations/admin/{id}/tables`: reemplaza las mesas asignadas. Valida que pertenezcan a la sede, cubran `partySize` y no tengan cruces; la liberación y creación se ejecutan en una transacción.

### Espacios

- `GET /reservations/admin-spaces?locationId={uuid}`
- `GET /reservations/admin-spaces/{id}`
- `POST /reservations/admin-spaces`
- `PATCH /reservations/admin-spaces/{id}`
- `DELETE /reservations/admin-spaces/{id}` — desactivación lógica.

### Mesas

- `GET /reservations/admin-tables?spaceId={uuid}`
- `GET /reservations/admin-tables/{id}`
- `POST /reservations/admin-tables`
- `PATCH /reservations/admin-tables/{id}`
- `DELETE /reservations/admin-tables/{id}` — desactivación lógica.

## Tablas y permisos

El módulo consulta o escribe `locations`, `venue_spaces`, `dining_tables`, `reservations`, `reservation_tables` y, para excluir bloqueos de eventos en disponibilidad, `event_space_bookings` y `events`. Usa los permisos existentes `reservations.read`, `reservations.create` y `reservations.manage`; la creación pública no necesita sesión ni permiso administrativo.

Las fechas almacenadas son `timestamptz(3)`. Los tests unitarios no abren PostgreSQL y el test HTTP se omite cuando falta `TEST_DATABASE_URL`.
