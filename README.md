# koffisoft_api

API y proceso backend de Koffi-Soft. Este repositorio será el dueño de los contratos HTTP, PostgreSQL, Prisma, autenticación con sesiones HttpOnly y TOTP, módulos de negocio comprobados contra el legacy y trabajos en segundo plano para correos, QR y PDFs. La base actual corresponde al baseline aprobado: NestJS funciona sobre Fastify, expone `GET /health/live` y Prisma incluye el esquema inicial de negocio, autorización y autenticación sin exigir una conexión durante los tests.

## Relación con los otros repositorios

- `koffisoft_web` consume los contratos públicos para catálogo, reservaciones, contacto y páginas relacionadas.
- `koffisoft_admin` consume los contratos privados para autenticación, autorización, catálogo, inventario, reservaciones, reportes y operaciones administrativas.
- `koffisoft_api` es el único repositorio que accederá a PostgreSQL; los frontends no contienen SQL, Prisma ni PHP.
- En la fase de contratos, esta API publicará la versión aprobada de `@koffisoft/contracts`; Fase 0 solo deja preparada la frontera y no inventa endpoints.
- El legacy en `D:\Lenny\Projects\Koffi-Soft` es de solo lectura. Sus credenciales, hashes, datos y código no se copian.

## Stack fijado

- Node.js `24.13.0` y pnpm `11.1.3`.
- NestJS `12.1.2` con `@nestjs/platform-fastify` `12.1.2` y Fastify `5.12.5`.
- TypeScript `5.9.3`, modo estricto y módulos ESM `NodeNext`.
- Prisma `7.10.0`, `@prisma/client` `7.10.0`, `@prisma/adapter-pg` `7.10.0` y PostgreSQL mediante `pg` `8.23.1`.
- Validación preparada con `class-validator` `0.15.1` y `class-transformer` `0.5.1`.
- Vitest `5.0.3` con Supertest `7.3.1` para pruebas HTTP.
- ESLint `10.12.0`, TypeScript ESLint `8.71.0` y Prettier `3.9.9`.

Las versiones directas están fijadas sin rangos en `package.json`; `pnpm-lock.yaml` fija el árbol completo. El cliente generado por Prisma se crea en `src/generated/prisma/` y no se versiona.

## Requisitos e instalación

1. Instalar Node.js `24.13.0` y pnpm `11.1.3`.
2. Copiar `.env.example` a `.env`; usar solo valores locales o gestionados por el entorno.
3. Instalar dependencias:

   ```bash
   pnpm install
   ```

Después de instalar, `pnpm build` genera el cliente Prisma sin abrir una conexión a PostgreSQL. Para ejecutar consultas reales se necesitará una base aislada y una `DATABASE_URL` aprobada.

## Variables de entorno

`.env.example` no contiene secretos reales:

- `NODE_ENV`, `HOST` y `PORT`: ejecución del servidor.
- `DATABASE_URL`: conexión PostgreSQL local o gestionada; nunca subirla al repositorio.
- `SHADOW_DATABASE_URL`: conexión opcional a una base separada para `migrate dev` y `migrate diff --from-migrations`; nunca debe ser la misma que `DATABASE_URL`.
- `DATABASE_CONNECT_ON_BOOT`: `false` en la base de Fase 0; `true` solo cuando el entorno de aplicación deba conectar durante el arranque.
- `CORS_ORIGIN`: origen permitido de los frontends.
- `COOKIE_SECURE`: se habilitará según HTTPS en la fase de sesiones.

Prisma 7 usa `prisma.config.ts` para la URL de CLI y un cliente generado con `@prisma/adapter-pg`. El valor de respaldo local permite `generate`, `validate`, typecheck y tests sin PostgreSQL. `SHADOW_DATABASE_URL` es opcional para esos comandos, pero debe apuntar a una base local separada cuando se use `migrate dev` o `migrate diff --from-migrations`.

## Scripts

- `pnpm start:dev`: servidor NestJS con recarga mediante `tsx`.
- `pnpm build`: genera Prisma y compila `src/` a `dist/`.
- `pnpm start`: arranca `dist/main.js`.
- `pnpm lint`: ejecuta ESLint y comprueba el formato de Prettier.
- `pnpm format`: aplica Prettier.
- `pnpm typecheck`: verifica TypeScript estricto sin emitir.
- `pnpm test`: ejecuta Vitest y la prueba HTTP de `GET /health/live` con Supertest.
- `pnpm prisma:generate`: regenera el cliente sin conectarse a la base.
- `pnpm prisma:validate`: valida `prisma/schema.prisma` y `prisma.config.ts`.
- `pnpm db:migrate`: crea o actualiza una base local mediante `prisma migrate dev`.
- `pnpm db:deploy`: aplica migraciones existentes mediante `prisma migrate deploy`.
- `pnpm db:seed`: carga el SQL demo con `prisma db execute`.
- `pnpm db:reset`: recrea la base de desarrollo; es destructivo y no debe usarse contra una base real.

## Base de datos local

Con PostgreSQL 18 disponible localmente, crea una base vacía y configura `DATABASE_URL` en tu entorno local o en `.env` sin subir ese archivo:

```bash
createdb koffisoft_local
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

Para comprobar el estado del esquema antes de usar la aplicación:

```bash
pnpm prisma:validate
pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --config ./prisma.config.ts
```

En despliegues, usa `pnpm db:deploy` y ejecuta el seed solo cuando el entorno corresponda a una base demo. `pnpm db:reset` elimina y recrea objetos de la base configurada, por lo que queda reservado para una base local aislada. La migración inicial contiene el DDL; los datos demo viven en `prisma/seed/seed.sql` y no forman parte de una migración.

## Estructura

```text
src/
  database/                # PrismaService y frontera de persistencia
  health/                  # GET /health/live y su prueba HTTP
  app.module.ts            # composición del monolito modular
  main.ts                  # bootstrap Fastify
prisma/
  schema.prisma            # esquema aprobado; se mantiene junto a sus migraciones
  migrations/              # migraciones versionadas
  seed/seed.sql             # datos demo fuera del DDL de migraciones
prisma.config.ts           # configuración Prisma 7
docs/                      # reglas de documentación
.agents/skills/             # recetas para agentes de código
.github/workflows/          # CI
```

Los módulos futuros seguirán la frontera `module`, `controller`, `service`, `dto`, guards, pipes, interceptores y jobs cuando el contrato y el análisis del legacy los respalden. No se agregan endpoints de negocio en esta fase.

## Commits y ramas

Usar Conventional Commits con gitmoji: `✨ feat(api): agrega health check`, `🐛 fix(auth): corrige sesión`, `♻️ refactor(catalog): separa servicio`, `📝 docs: actualiza Prisma`, `🔧 config: ajusta CI`, `✅ tests: cubre endpoint`, `🔒️ seguridad: endurece cookie` y `🗃️ base de datos: agrega migración`. Mantener cada commit grande y coherente con una intención revisable.

La rama `main` debe recibir cambios revisados mediante pull request. El dueño crea y publica ramas. Los agentes no crean ramas, no hacen commits y no hacen push sin aprobación explícita de Lenny004.
