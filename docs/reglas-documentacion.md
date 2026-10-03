# Reglas de documentación de código

Estas reglas adaptan el espíritu de `reglas-documentacion-tsx.md` al backend NestJS, Prisma y jobs de Koffi-Soft.

## Propósito

Documentar en español módulos, controladores, servicios, DTOs, guards, pipes, interceptores, esquema Prisma y trabajos en segundo plano sin cambiar la lógica, el comportamiento, la arquitectura ni los contratos. La documentación debe explicar responsabilidad, flujo de datos y decisiones no evidentes.

## Reglas generales

1. No modificar lógica, firmas, decoradores, nombres, imports, validaciones o consultas para documentar.
2. Conservar documentación correcta y mantener el estilo del archivo.
3. Usar TSDoc (`/** ... */`) en símbolos públicos o complejos cuando aporte contexto real.
4. Explicar propósito, límites, invariantes y decisiones; no describir cada línea ni repetir el nombre.
5. No inventar endpoints, estados, roles, efectos, garantías de transacción, modelos o columnas.
6. Escribir comentarios en español, breves y junto al bloque que explican.
7. No revelar secretos, valores sensibles, credenciales ni datos reales del legacy.

## Módulos, controladores y servicios

Documentar una clase o método cuando no sea evidente:

- qué responsabilidad mantiene dentro del módulo;
- qué endpoint, caso de uso o dependencia coordina;
- qué datos valida, transforma, persiste o devuelve;
- qué errores, permisos o límites de transacción son relevantes;
- por qué existe una separación entre servicio, repositorio, job o adaptador.

No documentar decoradores, `return`, inyección de dependencias o llamadas obvias.

## DTOs, guards, pipes e interceptores

Documentar restricciones de campos solo cuando no se deduzcan de los tipos o decoradores. Explicar la razón de una transformación, normalización, autorización, orden de ejecución o formato de respuesta no evidente. No escribir en un comentario que una validación existe si el código no la ejecuta.

## Prisma y migraciones

Documentar en el esquema o en la migración la razón de un modelo, `@map`, `@@map`, índice, relación, procedimiento o trigger cuando sea una decisión de compatibilidad con el legacy. No usar comentarios para ocultar cambios destructivos ni afirmar que una migración es segura sin haberla probado sobre una copia aislada.

Las migraciones deben indicar alcance, precondiciones y estrategia expand/contract cuando aplique. Nunca incluir datos sensibles del dump.

## Jobs y efectos externos

Documentar qué evento crea un job, qué payload procesa, si es idempotente, cómo reintenta, qué recursos externos usa y qué sucede al fallar, pero solo cuando esas propiedades estén implementadas. No inventar garantías de entrega, cancelación o transacción.

## Proceso y entrega

1. Leer el módulo completo y sus pruebas antes de documentar.
2. Conservar comentarios correctos y agregar solo los necesarios.
3. Verificar con `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
4. Si se modifica Prisma, ejecutar `pnpm prisma:validate`; si se modifica un endpoint, conservar o agregar su prueba HTTP.

En la entrega informar por archivo: ruta, resumen, símbolos o secciones documentados, confirmación de que no cambió la lógica y verificaciones ejecutadas. Si un archivo no requiere cambios, indicarlo.
