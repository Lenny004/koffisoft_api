# Usuarios, empleados, roles y permisos

El módulo P1 expone la administración de cuentas y empleados sobre las tablas
`users`, `employees`, `roles`, `permissions`, `user_roles`, `role_permissions`,
`user_sessions`, `user_mfa_factors`, `user_mfa_recovery_codes` y `audit_logs`.

Todas las rutas de este documento requieren una sesión server-side válida, MFA
cuando corresponda y el permiso indicado. Las mutaciones también pasan por el
guard CSRF global.

## Usuarios

- `GET /users/admin`: lista con `page`, `pageSize`, `search`, `status` y `role`.
  La búsqueda y los filtros se ejecutan en PostgreSQL antes de paginar.
- `GET /users/admin/:id`: devuelve el detalle sin hash de contraseña, secretos
  TOTP, URI `otpauth`, códigos de recuperación ni cookies.
- `POST /users/admin`: crea una cuenta con contraseña Argon2id, vínculo opcional
  a empleado y roles activos opcionales.
- `PATCH /users/admin/:id`: actualiza username, correo o vínculo a empleado.
- `POST /users/admin/:id/activate`: activa la cuenta y limpia su bloqueo.
- `POST /users/admin/:id/deactivate`: desactiva y revoca todas sus sesiones.
- `POST /users/admin/:id/block`: bloquea y revoca todas sus sesiones.
- `PUT /users/admin/:id/roles`: reemplaza las asignaciones activas de roles.
- `POST /users/admin/:id/reset-mfa`: desactiva factores MFA e invalida códigos
  de recuperación sin devolver material secreto.
- `POST /users/admin/:id/force-password-change`: exige el cambio en el próximo
  acceso de la cuenta.

Las operaciones sensibles escriben un `AuditLog` dentro de la misma
transacción que el cambio de negocio. Los datos auditados son metadatos
operativos mínimos; nunca incluyen contraseñas, hashes, tokens, secretos MFA,
URI TOTP o códigos.

## Empleados

- `GET /employees/admin`: lista con `page`, `pageSize`, `search`, `locationId`,
  `status` y `jobCode`.
- `GET /employees/admin/:id`: consulta el detalle y el usuario vinculado.
- `POST /employees/admin`: crea un empleado y puede vincular un usuario libre.
- `PATCH /employees/admin/:id`: edita los datos laborales y el vínculo.
- `DELETE /employees/admin/:id`: desactiva lógicamente y registra la fecha de
  terminación si todavía no existe.

El vínculo es uno a uno: un empleado no puede pertenecer a más de un usuario y
un usuario no puede quedar vinculado a dos empleados. El servicio valida sede,
fechas, unicidad de código dentro de la sede y consistencia del vínculo dentro
de la transacción.

## Roles y permisos

- `GET /users/admin/roles` requiere `roles.read` y admite `businessId` e
  `includeInactive`.
- `GET /users/admin/permissions` requiere `permissions.read` y admite
  `includeInactive`.
- Crear, editar, activar, bloquear, desactivar, restablecer MFA y forzar cambio
  de contraseña requieren `users.manage`.
- La asignación de roles requiere `roles.manage`.
- Los listados de usuarios y empleados requieren `users.read`.

El seed conserva `users.read`, `roles.read`, `roles.manage` y
`permissions.read`, y agrega `users.manage` a los roles `owner` y `admin`.

## Invariantes de seguridad

- Un administrador no puede desactivar ni bloquear su propia cuenta.
- Un usuario no puede quitarse su propio rol `admin` o `owner`.
- Las operaciones de estado o roles no pueden dejar el sistema sin un usuario
  activo con rol administrativo.
- Desactivar o bloquear revoca las sesiones activas del usuario en la misma
  transacción y registra el hecho de seguridad mínimo correspondiente.
- `must_change_password` permite representar de forma explícita el flujo de
  cambio obligatorio. El login y `GET /auth/me` lo informan; el guard restringe
  el resto de rutas hasta que `POST /auth/password` lo limpia.

## Cambio de esquema

La migración `20261012150000_users_admin` agrega `users.must_change_password`,
porque el schema inicial no tenía una marca durable para el cambio obligatorio.
La columna `role_permissions.active` ya pertenece a la migración previa de
eliminaciones lógicas y se reutiliza sin modificarla. La migración inicial
permanece intacta; el cambio P1 es aditivo y no requiere reset ni conexión
durante la validación local.
