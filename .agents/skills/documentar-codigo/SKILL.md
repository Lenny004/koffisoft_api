---
name: documentar-codigo
description: Documenta en español cada función y método (TSDoc obligatorio) en módulos NestJS, servicios, controladores, guards, pipes, Prisma y jobs, siguiendo docs/reglas-documentacion.md. Usar al documentar koffisoft_api sin cambiar comportamiento.
---

# Documentar código de la API

## Objetivo

Cada **declaración** de función o método en `src/` (excluye `*.spec.ts` y `*.e2e.spec.ts`) debe tener un bloque `/** ... */` en **español** inmediatamente encima. Aplica a:

- Métodos de servicios, controladores, guards, pipes, interceptores y schedulers.
- Funciones sueltas y `const` con cuerpo de función exportadas.
- Helpers de módulo y factories (`export const createX = ...`) cuando declaran lógica.

No documentar solo decoradores, getters triviales ni archivos que solo definen tipos/DTOs sin métodos ni funciones.

**Excluir** `src/generated/**` (Prisma): no editar código generado; la auditoría lo omite.

## Proceso

1. Leer `docs/reglas-documentacion.md` y las pruebas del módulo antes de editar.
2. Ejecutar `node scripts/audit-docs.mjs` para ver pendientes.
3. Añadir TSDoc con responsabilidad, datos que valida o persiste, errores relevantes y decisiones no evidentes.
4. No revelar secretos ni datos del legacy en comentarios.
5. **No** refactorizar, cambiar decoradores, consultas Prisma, firmas ni dependencias; no inventar garantías.
6. Verificar: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; `pnpm prisma:validate` si se tocó Prisma.
7. Regenerar checklist: `node scripts/generate-checklist.mjs`.

## Formato TSDoc mínimo

```ts
/**
 * Caso de uso que resuelve y límites relevantes (permisos, transacción, idempotencia).
 */
async crearReserva(dto: CreateReservationDto): Promise<ReservationResponseDto> { ... }
```

## Entrega

Por archivo: ruta, resumen, símbolos documentados, confirmación de que no cambió la lógica y verificaciones ejecutadas.

## Auditoría

| Comando | Salida |
| --- | --- |
| `node scripts/audit-docs.mjs` | Resumen + `scripts/audit-docs-result.json` |
| `node scripts/generate-checklist.mjs` | `docs/checklist-documentacion.md` |
