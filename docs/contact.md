# Bandeja de mensajes de contacto

El modulo `src/contact` recibe mensajes del formulario publico y los pone a
disposicion del panel administrativo con alcance por sede.

## Contrato publico

- `POST /contact` valida `locationId`, nombre, correo, telefono y mensaje.
- `website` es un campo honeypot; una solicitud rellenada se acepta sin
  escribir datos.
- El limite basico es de cinco solicitudes por IP y sede cada minuto.
- Un mensaje identico del mismo correo dentro de quince minutos se acepta
  de forma idempotente y no se duplica.

## Contrato administrativo

- `GET /contact/admin` y `GET /contact/admin/:id` requieren
  `contact.read`.
- `PATCH /contact/admin/:id` requiere `contact.manage` para cambiar estado,
  asignacion o archivado.
- Las conversiones usan `POST /contact/admin/:id/customer`,
  `/reservation` o `/event` y son idempotentes para el vinculo existente.
- Cada consulta y mutacion comprueba `locationId` con el alcance de la
  sesion y registra `contact_message.*` en `audit_logs`.

La migracion es aditiva: agrega archivado, indices por sede y permisos, sin
eliminar columnas ni datos existentes.
