---
name: documentar-codigo
description: Documenta módulos NestJS, controladores, servicios, DTOs, guards, pipes, interceptores, Prisma y jobs en español siguiendo docs/reglas-documentacion.md. Usar cuando se solicite documentar koffisoft_api sin cambiar comportamiento.
---

# Documentar código de la API

1. Leer `docs/reglas-documentacion.md` y revisar el módulo y sus pruebas antes de editar.
2. Identificar responsabilidades, contratos, DTOs, validaciones, dependencias, consultas Prisma y efectos externos que necesiten explicación.
3. Agregar TSDoc en español para decisiones no evidentes; documentar invariantes y límites solo cuando estén implementados.
4. No refactorizar, renombrar, cambiar decoradores, modificar consultas, agregar dependencias ni inventar garantías.
5. No revelar secretos, datos del legacy ni valores sensibles en los comentarios.
6. Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`; ejecutar `pnpm prisma:validate` si se tocó Prisma.
7. Entregar por archivo la ruta, resumen, símbolos documentados, confirmación de que no cambió la lógica y verificaciones.
