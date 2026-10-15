# Respaldos operativos

El módulo `backups` genera artefactos fuera de PostgreSQL en un directorio local
del VPS. `database` usa `pg_dump` en formato custom, `uploads` empaqueta la
carpeta configurada con `tar` y `full` incluye ambos. Los comandos se ejecutan
sin shell y nunca se escriben credenciales en logs, auditoría o respuestas.

## Configuración del VPS

Define estas variables en el entorno del servicio, no en archivos versionados:

- `BACKUP_ENABLED=true` habilita generación manual y programada.
- `BACKUP_STORAGE_ROOT` apunta a un volumen privado con espacio suficiente.
- `UPLOADS_DIRECTORY` apunta a la carpeta real de uploads/imagenes.
- `PG_DUMP_PATH` y `TAR_PATH` permiten usar rutas absolutas o comandos del PATH.
- `BACKUP_RETENTION_DAYS` define la fecha de expiración de cada artefacto.
- `BACKUP_MAX_SIZE_BYTES` rechaza archivos que superen el límite configurado.
- `BACKUP_SCHEDULE_MINUTES=0` desactiva el scheduler; un valor positivo genera
  respaldos `full` con ese intervalo y aplica la retención en el mismo ciclo.

El directorio de respaldos debe tener permisos de lectura/escritura únicamente
para la cuenta del proceso de la API y no debe publicarse con `@fastify/static`.
Monta o respalda ese directorio en un almacenamiento independiente del disco
que contiene la base de datos para conservar utilidad frente a una pérdida del
VPS.

## Programación

La API incluye un scheduler NestJS opt-in y no requiere Docker. Como alternativa
operativa, se puede mantener `BACKUP_SCHEDULE_MINUTES=0` y llamar la API con un
cron autenticado por un mecanismo de sesión administrada; no se deben guardar
cookies ni credenciales en el repositorio. El scheduler integrado es la opción
recomendada para este bloque porque registra el estado del job y sus errores.

## Contrato administrativo

- `POST /backups/admin` inicia un job con `type=database|uploads|full` y requiere
  `backups.create`.
- `GET /backups/admin?limit=100` lista fecha, tamaño, checksum, expiración,
  estado y error seguro; requiere `backups.read`.
- `GET /backups/admin/:id/download` verifica estado, expiración, tamaño y
  SHA-256, y entrega un stream autenticado; requiere `backups.download`.
- `DELETE /backups/admin/:id` elimina el artefacto y conserva el registro como
  `expired`; requiere `backups.delete`.

Cada transición relevante crea un `AuditLog` con actor, job, estado, tamaño y
checksum. Los archivos temporales se escriben bajo `.tmp/<job-id>` y se mueven
atómicamente a una referencia generada por la API. La transición condicional de
`pending` a `running` hace que una reejecución del worker no procese dos veces
el mismo job.

## Recuperación

Para restaurar un dump custom usa las herramientas de PostgreSQL del entorno
aislado de recuperación, revisa primero el checksum registrado y restaura con
`pg_restore`. Un respaldo `uploads` o `full` debe extraerse en una carpeta
aislada antes de reemplazar la carpeta activa. La restauración no forma parte
de un endpoint HTTP ni se ejecuta desde el panel.
