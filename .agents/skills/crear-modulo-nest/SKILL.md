---
name: crear-modulo-nest
description: Crea un módulo NestJS 12 con controlador, servicio, DTO y prueba HTTP usando Fastify y TypeScript estricto. Usar cuando el contrato aprobado agregue un módulo a koffisoft_api.
---

# Crear un módulo NestJS

1. Confirmar el endpoint, DTO, permiso y trazabilidad en `02-plan-3-repos.md` o en el contrato aprobado; no inventar funcionalidad.
2. Crear una carpeta bajo `src/<modulo>/` con `<modulo>.module.ts`, `<modulo>.controller.ts`, `<modulo>.service.ts`, DTOs en `dto/` y pruebas `*.spec.ts`.
3. Registrar el módulo en `AppModule` o en el módulo padre correspondiente; mantener Prisma detrás de `PrismaService`.
4. Definir DTOs con tipos estrictos y `class-validator` solo para reglas respaldadas; usar guards, pipes e interceptores solo si el contrato los exige.
5. Mantener controladores delgados: reciben HTTP, delegan al servicio y exponen el contrato. El servicio coordina reglas y persistencia.
6. Probar la respuesta HTTP con `@nestjs/testing` y Supertest sin conectar PostgreSQL por defecto; usar mocks o una base aislada explícita para integración.
7. Documentar decisiones no evidentes con TSDoc en español y ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm prisma:validate` si aplica.
