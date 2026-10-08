<!-- readme-standard:v1 -->
<!-- Esta línea permite que los agentes de IA reconozcan y actualicen este README. No la borres. -->

<!-- section:header -->

# koffisoft_api

> API backend de Koffi-Soft para autenticación, autorización, salud del servicio y contratos HTTP.

[![CI](https://github.com/Lenny004/koffisoft_api/actions/workflows/ci.yml/badge.svg)](https://github.com/Lenny004/koffisoft_api/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](LICENSE)

<!-- section:toc -->

## 📑 Contenido

- [Aspectos destacados](#-aspectos-destacados)
- [Descripción](#-descripción)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Configuración](#-configuración)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Desarrollo](#-desarrollo)
- [Pruebas](#-pruebas)
- [Hoja de ruta y estado](#-hoja-de-ruta-y-estado)
- [Soporte y contribuciones](#-soporte-y-contribuciones)
- [Autores y agradecimientos](#-autores-y-agradecimientos)
- [Licencia](#-licencia)

<!-- section:highlights -->

## 🌟 Aspectos destacados

- **Sesiones server-side:** las sesiones usan cookies HttpOnly, rotación de token, expiraciones y revocación.
- **Autenticación multifactor:** TOTP y códigos de recuperación protegen las cuentas que requieren MFA.
- **API documentada:** Swagger está disponible en `/docs` fuera de producción y OpenAPI se puede exportar a un archivo.
- **Persistencia controlada:** Prisma 7 mantiene el esquema y las migraciones de PostgreSQL en una frontera única.
- **Catálogo de menú:** la carta web y la administración de categorías, ítems, variantes, precios, alérgenos, disponibilidad y modificadores viven en la API.
- **Reservas y eventos:** disponibilidad pública, mesas, espacios, solicitudes de eventos, paquetes y cotizaciones versionadas usan los modelos reales del dominio.

<!-- section:overview -->

## ℹ️ Descripción

`koffisoft_api` es el backend de Koffi-Soft, un sistema para un café/restaurante de la Ruta Panorámica de El Salvador. Es dueño de los contratos HTTP y el único repositorio que accede a PostgreSQL; `koffisoft_web` y `koffisoft_admin` consumen la API sin incluir SQL, Prisma ni PHP.

El alcance aprobado incluye NestJS sobre Fastify, el endpoint público `GET /health/live`, la carta pública `GET /menu`, reservas de mesa, eventos privados y el módulo de autenticación y autorización de la Fase 1. Los contratos compartidos y los trabajos de correo, QR y PDF quedan sujetos a sus fases y planes aprobados. El repositorio legacy se usa como referencia de solo lectura y no se copian sus credenciales, hashes, datos ni código.

Consulta la guía de autenticación en [docs/auth.md](docs/auth.md), la guía del catálogo en [docs/menu.md](docs/menu.md), las guías de [reservas](docs/reservations.md) y [eventos](docs/events.md), y el diseño de la base de datos en [docs/database/database-design.md](docs/database/database-design.md).

**Stack:** Node.js 24.13.0, pnpm 11.1.3, NestJS 12.1.2, Fastify 5.12.5, TypeScript 5.9.3, Prisma 7.10.0 y PostgreSQL.

<!-- section:requirements -->

## 📋 Requisitos

- Node.js `24.13.0`, indicado por `.nvmrc`.
- pnpm `11.1.3`, fijado en `package.json` mediante `packageManager`.
- PostgreSQL 18 para una base local de desarrollo y pruebas de integración.
- `argon2` `0.45.1`, que requiere su build nativo permitido por `pnpm-workspace.yaml`.

Las versiones directas del resto del stack están fijadas sin rangos en `package.json`: `@nestjs/platform-fastify` `12.1.2`, `@prisma/client` `7.10.0`, `@prisma/adapter-pg` `7.10.0`, `pg` `8.23.1`, `class-validator` `0.15.1`, `class-transformer` `0.5.1`, `otplib` `13.5.0`, `@nestjs/throttler` `6.7.1`, `@nestjs/swagger` `12.0.2`, Vitest `5.0.3`, Supertest `7.3.1`, ESLint `10.12.0`, TypeScript ESLint `8.71.0` y Prettier `3.9.9`.

<!-- section:installation -->

## ⬇️ Instalación

```bash
git clone https://github.com/Lenny004/koffisoft_api.git
cd koffisoft_api
corepack enable
pnpm install
cp .env.example .env
pnpm prisma:generate
```

Completa `.env` con valores locales o gestionados por el entorno antes de iniciar la API. `MFA_ENCRYPTION_KEY` debe ser una llave Base64 de exactamente 32 bytes. La generación del cliente Prisma no abre una conexión a PostgreSQL; las consultas reales requieren una base aislada y una `DATABASE_URL` aprobada.

<!-- section:usage -->

## 🚀 Uso

Inicia el servidor en desarrollo:

```bash
pnpm start:dev
```

Comprueba que el proceso HTTP está vivo:

```bash
curl http://localhost:3000/health/live
```

La respuesta esperada contiene `{"status":"ok","service":"koffisoft-api"}`. Fuera de producción, la documentación interactiva está en [http://localhost:3000/docs](http://localhost:3000/docs).

El módulo de autenticación expone estos endpoints; los cuerpos, estados, cookies, flujos MFA y reglas de autorización están en [docs/auth.md](docs/auth.md):

- `POST /auth/login`
- `POST /auth/mfa/verify`
- `POST /auth/mfa/recovery`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`
- `POST /auth/mfa/totp/setup`
- `POST /auth/mfa/totp/confirm`
- `POST /auth/mfa/totp/disable`
- `POST /auth/mfa/recovery-codes`
- `POST /auth/password`

El módulo de menú expone la carta pública y las rutas administrativas documentadas en [docs/menu.md](docs/menu.md). Una consulta mínima de la carta es:

```bash
curl "http://localhost:3000/menu?locationId=TU_LOCATION_ID"
```

Las consultas públicas de disponibilidad y el catálogo de eventos están documentados en [docs/reservations.md](docs/reservations.md) y [docs/events.md](docs/events.md).

<!-- section:configuration -->

## ⚙️ Configuración

La tabla coincide con `.env.example`. Sus valores son ejemplos locales; no los uses como secretos de producción.

| Variable                   | Descripción                                                             | Ejemplo                                        | Requerida |
| -------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- | --------- |
| `NODE_ENV`                 | Entorno de ejecución y activación de Swagger fuera de producción.       | `development`                                  | No        |
| `HOST`                     | Interfaz donde escucha el servidor.                                     | `0.0.0.0`                                      | No        |
| `PORT`                     | Puerto HTTP de la API.                                                  | `3000`                                         | No        |
| `DATABASE_URL`             | URL de PostgreSQL usada por la aplicación y las migraciones.            | `postgresql://localhost:5432/koffisoft_local`  | No        |
| `SHADOW_DATABASE_URL`      | URL opcional de una base separada para `migrate dev` y `migrate diff`.  | `postgresql://localhost:5432/koffisoft_shadow` | No        |
| `DATABASE_CONNECT_ON_BOOT` | Indica si Prisma conecta durante el arranque.                           | `false`                                        | No        |
| `CORS_ORIGIN`              | Lista exacta, separada por comas, de orígenes HTTP(S) permitidos.       | `http://localhost:5173`                        | No        |
| `COOKIE_SECURE`            | Activa `Secure` y el prefijo `__Host-` aplicable a la cookie de sesión. | `false`                                        | No        |
| `SESSION_COOKIE_NAME`      | Nombre base de la cookie de sesión.                                     | `koffisoft_session`                            | No        |
| `MFA_ENCRYPTION_KEY`       | Llave Base64 de exactamente 32 bytes para cifrar secretos TOTP.         | `REPLACE_WITH_BASE64_32_BYTE_KEY`              | Sí        |
| `MFA_KEY_VERSION`          | Versión de la llave usada para cifrar factores MFA.                     | `1`                                            | No        |
| `MFA_REQUIRED_ROLES`       | Roles que deben tener TOTP activo, separados por comas.                 | `owner,admin,manager`                          | No        |
| `SESSION_IDLE_MINUTES`     | Minutos de inactividad antes de expirar una sesión.                     | `30`                                           | No        |
| `SESSION_ABSOLUTE_HOURS`   | Límite absoluto de vida de una sesión en horas.                         | `8`                                            | No        |
| `AUTH_LOGIN_MAX_ATTEMPTS`  | Intentos fallidos antes del bloqueo temporal.                           | `5`                                            | No        |
| `AUTH_LOGIN_LOCK_MINUTES`  | Duración del bloqueo temporal en minutos.                               | `15`                                           | No        |
| `TEST_DATABASE_URL`        | URL de la base aislada que habilita las pruebas e2e de auth.            | `postgresql://localhost:5432/koffisoft_test`   | No        |

`DATABASE_URL` tiene un respaldo local para generar y validar Prisma, pero debe configurarse para migrar o consultar una base. `SHADOW_DATABASE_URL` nunca debe apuntar a la misma base que `DATABASE_URL`.

<!-- section:structure -->

## 🗂️ Estructura del proyecto

```text
.
├── .agents/skills/             # Recetas para agentes de código
├── .github/workflows/          # Verificación continua
├── docs/                       # Auth, menú, base de datos y reglas de documentación
├── prisma/                     # Schema, migraciones y seed SQL
├── scripts/                    # Utilidades de usuario y exportación OpenAPI
├── src/                        # Monolito modular NestJS
│   ├── auth/                   # Autenticación, MFA, sesiones y autorización
│   ├── common/                 # Filtros HTTP compartidos
│   ├── config/                 # Configuración y validación de entorno
│   ├── database/               # Frontera Prisma
│   ├── generated/              # Cliente Prisma generado, no versionado
│   ├── health/                 # GET /health/live y prueba HTTP
│   ├── menu/                   # Carta pública y administración del catálogo
│   ├── reservations/           # Disponibilidad, reservas, espacios y mesas
│   ├── events/                 # Eventos privados, paquetes y cotizaciones
│   └── jobs/                   # Frontera reservada para trabajos futuros
├── .env.example                # Variables de entorno de ejemplo
├── AGENTS.md                   # Reglas para agentes de código
├── LICENSE                     # Licencia MIT
├── package.json                # Scripts y dependencias fijadas
├── pnpm-lock.yaml              # Árbol de dependencias bloqueado
└── prisma.config.ts            # Configuración de Prisma 7
```

<!-- section:development -->

## 🛠️ Desarrollo

Scripts disponibles en `package.json`:

```bash
pnpm start:dev
pnpm start
pnpm lint
pnpm format
pnpm typecheck
pnpm build
pnpm prisma:generate
pnpm prisma:validate
```

Para una base local aislada, configura `DATABASE_URL` y, cuando corresponda, `SHADOW_DATABASE_URL`:

```bash
createdb koffisoft_local
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

La migración inicial contiene el DDL y `prisma/seed/seed.sql` contiene los datos demo fuera de las migraciones. `pnpm db:deploy` aplica migraciones existentes; `pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --config ./prisma.config.ts` compara el historial con el schema. `pnpm db:reset` es destructivo y queda reservado para una base local aislada.

Para crear o actualizar una cuenta local, `pnpm auth:create-user` acepta `--email`, `--password`, `--role` y `--username`; también lee `AUTH_USER_EMAIL`, `AUTH_USER_PASSWORD`, `AUTH_USER_ROLE` y `AUTH_USER_USERNAME` cuando no se pasan las opciones. No guardes esas credenciales en archivos versionados.

```bash
pnpm auth:create-user -- --email=TU_CORREO_LOCAL --password=TU_CONTRASEÑA_LOCAL --role=viewer
```

`pnpm openapi:export` genera `openapi.json` con el contrato documentado de autenticación y autorización.

<!-- section:testing -->

## ✅ Pruebas

```bash
pnpm test
```

Las pruebas unitarias cubren Argon2id, AES-256-GCM, TOTP, guards de permisos, CSRF, disponibilidad y transiciones de reservas, solapamientos de espacios, totales exactos de cotizaciones y las reglas del servicio de menú; también se verifica el endpoint `GET /health/live` sin PostgreSQL. `src/auth/auth.e2e.spec.ts`, `src/menu/menu.e2e.spec.ts`, `src/reservations/reservations.e2e.spec.ts` y `src/events/events.e2e.spec.ts` usan `Fastify.inject` y se omiten si no existe `TEST_DATABASE_URL`; al habilitarlas requieren una base de pruebas aislada con el schema y seed aplicados.

La verificación completa del repositorio es:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

<!-- section:roadmap -->

## 🗺️ Hoja de ruta y estado

- [x] Baseline NestJS/Fastify, health check y frontera Prisma con migraciones versionadas.
- [x] Fase 1: sesiones, TOTP, recuperación, CSRF, rate limiting, auditoría, roles y permisos efectivos.
- [x] Módulo de menú: carta pública y administración del catálogo existente.
- [x] Módulos de reservas y eventos: disponibilidad, mesas, espacios, paquetes y cotizaciones.
- [ ] Publicar la versión aprobada de `@koffisoft/contracts` en la fase de contratos.
- [ ] Completar endpoints de negocio únicamente después de aprobar su contrato y análisis del legacy.
- [ ] Implementar trabajos de correo, QR y PDF dentro de la frontera jobs/outbox cuando una fase posterior los autorice.

<!-- section:contributing -->

## 💡 Soporte y contribuciones

Reporta errores o solicita cambios en [Issues de GitHub](https://github.com/Lenny004/koffisoft_api/issues). Las propuestas deben llegar mediante pull request hacia `main`, con una intención revisable y las verificaciones del repositorio ejecutadas. Usa Conventional Commits con gitmoji (`✨ feat`, `🐛 fix`, `♻️ refactor`, `📝 docs`, `🔧 config`, `✅ tests`, `🔒️ seguridad` y `🗃️ base de datos`). Los agentes no crean ramas, commits ni hacen push sin aprobación explícita del dueño.

<!-- section:authors -->

## ✍️ Autores y agradecimientos

- [Lenny004 (LENNYX 004)](https://github.com/Lenny004) — desarrollador.

<!-- section:license -->

## 📄 Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta [LICENSE](LICENSE).
