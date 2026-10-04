# Reglas para agentes de código

Estas reglas aplican a Codex, Cursor, Claude y cualquier otro agente que modifique `koffisoft_api`.

## Alcance y arquitectura

- Este repositorio es un monolito modular NestJS 12 sobre Fastify, TypeScript estricto, Prisma 7 y PostgreSQL.
- Cada módulo de API debe separar controlador, servicio, DTOs y pruebas; guards, pipes, interceptores y jobs se agregan solo cuando el contrato los requiere.
- Prisma es la única frontera de persistencia. Los frontends consumen contratos HTTP y nunca PostgreSQL.
- La API será la fuente de `@koffisoft/contracts` cuando se implemente la fase de contratos; en Fase 0 no se inventan endpoints ni esquemas.
- La autenticación aprobada será server-side con sesiones en cookies HttpOnly y TOTP; no reemplazarla por tokens en `localStorage`.
- Los trabajos de correo, QR y PDF vivirán dentro de este repositorio en una frontera explícita de jobs/outbox cuando una fase posterior los implemente.
- No inventar endpoints, modelos, columnas, permisos, reportes ni datos de negocio durante la Fase 0.

## Documentación

Leer [docs/reglas-documentacion.md](docs/reglas-documentacion.md) antes de documentar. Las skills en `.agents/skills/` contienen recetas para módulos NestJS y migraciones Prisma sin saltarse los límites del plan.

## Prisma, schema y migraciones

- `prisma/schema.prisma` y la migración correspondiente deben actualizarse juntos; revisar su coherencia con `prisma migrate diff` antes de entregar.
- Nunca editar una migración que ya fue aplicada. Los cambios posteriores requieren una nueva migración versionada y la aprobación correspondiente.
- `CHECK`, `EXCLUDE`, columnas generadas, vistas, triggers e índices parciales o expresivos que Prisma no represente viven en el SQL personalizado de la migración y deben quedar explicados con comentarios `///` en el schema cuando aplique.
- Los datos demo viven en `prisma/seed/seed.sql`, no en las migraciones. Nunca colocar secretos reales, tokens, contraseñas ni secretos TOTP en el seed.

## Límites y seguridad

- No modificar `D:\Lenny\Projects\Koffi-Soft`, la base real ni el dump legacy.
- No copiar credenciales, hashes, tokens SMTP, cookies, dumps sensibles o secretos a código, tests, logs, README o `.env.example`.
- No abrir conexiones a PostgreSQL durante health checks o tests unitarios salvo que la prueba declare una base aislada explícita.
- No ejecutar migraciones destructivas, `migrate reset`, introspección contra una base real ni cambios de esquema sin aprobación y respaldo.
- No agregar dependencias o módulos que no estén respaldados por el contrato y el plan.

## Verificación obligatoria

Antes de terminar cualquier cambio, deben pasar:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Cuando se modifique Prisma, ejecutar también `pnpm prisma:validate`. Los tests de integración que necesiten PostgreSQL deben usar una base aislada y documentada.

## Commits y control del repositorio

Usar gitmoji con Conventional Commits: `✨ feat`, `🐛 fix`, `♻️ refactor`, `📝 docs`, `🔧 config`, `✅ tests`, `🔒️ seguridad` y `🗃️ base de datos`. Preferir commits grandes, coherentes y fáciles de revisar.

El agente **NUNCA crea ramas, hace commits ni hace push** sin aprobación explícita del dueño. Debe dejar los cambios sin commitear para revisión.
