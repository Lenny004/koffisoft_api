# Contenido editable del sitio

El módulo `src/site` expone el contenido operativo y editorial de una sede.

## Contrato

- `GET /site?locationId=<uuid>` es público y devuelve sede, horarios, excepciones y perfil del negocio.
- `GET /site/admin?locationId=<uuid>` requiere `site_content.read` y alcance sobre la sede.
- `PATCH /site/admin?locationId=<uuid>` requiere `site_content.manage`, valida el contrato y registra `site_content.updated` en `audit_logs`.

La actualización reemplaza horarios y excepciones dentro de una transacción y hace upsert del perfil único del negocio. El esquema reutiliza `locations`, `location_hours` y `location_hour_overrides`; solo agrega `business_site_profiles` y los permisos del módulo.

## Validaciones

Los DTOs limitan texto, URLs HTTP(S), coordenadas, días y horas. El servicio rechaza ventanas inválidas, duplicados y excepciones abiertas sin horas. La prueba unitaria no requiere PostgreSQL y cubre el mapeo público y el rechazo temprano de una ventana inválida.
