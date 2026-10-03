---
name: agregar-migracion-prisma
description: Agrega una migración Prisma 7 para PostgreSQL conservando trazabilidad con el legacy y evitando conexiones o resets no aprobados. Usar cuando se apruebe un cambio de esquema.
---

# Agregar una migración Prisma

1. Confirmar que el cambio de esquema está aprobado y que existe una copia aislada y restaurable de la base; no apuntar al legacy ni a producción.
2. Actualizar `prisma/schema.prisma` con nombres físicos conservados mediante `@map` y `@@map` cuando la compatibilidad lo requiera.
3. Ejecutar `pnpm prisma:validate` antes de generar una migración.
4. Con `DATABASE_URL` apuntando solo a la copia aislada, ejecutar `pnpm prisma migrate dev --name <nombre>`; nunca ejecutar `migrate reset` sin aprobación explícita.
5. Revisar el SQL generado, índices, claves, procedimientos y triggers; documentar precondiciones, compatibilidad y estrategia expand/contract.
6. Regenerar el cliente con `pnpm prisma:generate` y actualizar pruebas de repositorio o integración sin incluir datos sensibles.
7. Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm prisma:validate`; informar el nombre de la migración y la base aislada usada.
