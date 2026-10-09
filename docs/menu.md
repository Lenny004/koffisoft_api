# Menú y catálogo

El módulo `menu` publica la carta web y administra el catálogo operativo de una sede. Usa únicamente las tablas existentes del schema Prisma; no agrega columnas ni cambia la migración inicial.

## Alcance y reglas

- La sede se identifica con `locationId`. Es obligatorio en la carta pública porque precios y disponibilidad son locales.
- La carta pública usa el canal `web`, selecciona solo categorías `active`, ítems `active` y `publicVisible`, variantes `active` y precios web vigentes.
- Un ítem sin variante con precio web vigente no se publica. Las variantes que no están dentro de su ventana horaria o tienen un agotado activo se devuelven con `available=false`.
- La disponibilidad se calcula con la zona horaria de `locations.timezone`, el día ISO (`lunes=1` a `domingo=7`), la ventana `menu_availability` y los rangos estacionales. Un `menu_item_outage` activo prevalece sobre el horario.
- La respuesta pública contiene precios de venta, moneda, impuesto incluido, alérgenos y modificadores; no contiene SKU, costos, timestamps, razones de agotado, auditoría ni campos de preparación.
- El borrado administrativo es lógico: las operaciones `DELETE` establecen `active=false`. El historial de precios no se elimina físicamente.
- El schema no tiene `display_order` en `menu_items`; por eso el reordenamiento administrativo aplica a categorías. Los grupos de modificadores sí conservan su orden por variante.
- Los alérgenos se declaran por `menu_item_variants`, que es la granularidad definida por el schema. La presencia permitida es `contains` o `may_contain`.
- Los precios históricos están protegidos por la restricción SQL de no traslape de variante, sede, canal y vigencia.
- No se escribe en `auth_events`: ese modelo está reservado a hechos de autenticación y no existe en el repositorio un patrón separado para auditar cambios de negocio.

## Carta pública

Estas rutas llevan `@Public()` y no requieren cookie de sesión.

- `GET /menu?locationId={uuid}`: carta completa agrupada por categoría.
  - `category`: filtra por slug de categoría.
  - `allergen`: filtra por código de alérgeno, incluyendo `contains` y `may_contain`.
- `GET /menu/items/{slug}?locationId={uuid}`: detalle de un ítem visible en esa sede.
  - También acepta `category` y `allergen` con las mismas reglas de la carta.

Las respuestas públicas usan `amount` y `priceDelta` como cadenas decimales para no perder precisión. El canal no es seleccionable por el cliente: siempre es `web`.

## Administración de categorías e ítems

Las lecturas administrativas requieren `catalog.read`; las mutaciones requieren `catalog.manage`.

- `GET /menu/admin/categories`: lista paginada de categorías.
- `GET /menu/admin/categories/{id}?locationId={uuid}`: detalle de una categoría.
- `POST /menu/admin/categories`: crea una categoría con `locationId`, slug, nombres, descripciones y `displayOrder`.
- `PATCH /menu/admin/categories/{id}?locationId={uuid}`: actualiza campos de la categoría o `active`.
- `DELETE /menu/admin/categories/{id}?locationId={uuid}`: desactiva la categoría.
- `POST /menu/admin/categories/reorder?locationId={uuid}`: recibe `{ "categories": [{ "id": "...", "displayOrder": 1 }] }` y actualiza el orden en una transacción.
- `GET /menu/admin/items`: lista paginada y buscable por SKU, slug o nombre.
- `GET /menu/admin/items/{id}`: detalle de ítem y resumen de variantes.
- `POST /menu/admin/items`: crea un ítem; las variantes se crean por su recurso separado.
- `PATCH /menu/admin/items/{id}`: actualiza el ítem, `active` o `publicVisible`.
- `DELETE /menu/admin/items/{id}`: desactiva el ítem.

Los listados administrativos aceptan `page`, `pageSize` (máximo 100), `search` e `includeInactive=true`. Las respuestas incluyen `data` y `meta` con total y total de páginas.

## Variantes y precios

Las variantes usan `catalog.read` para lectura y `catalog.manage` para crear, editar o desactivar. Cada variante requiere una `prepStation` de la misma sede del ítem.

- `GET /menu/admin/items/{itemId}/variants`: lista paginada y buscable de variantes.
- `POST /menu/admin/items/{itemId}/variants`: crea una presentación vendible.
- `GET /menu/admin/variants/{id}`: consulta una variante.
- `PATCH /menu/admin/variants/{id}`: actualiza o desactiva una variante.
- `DELETE /menu/admin/variants/{id}`: desactiva una variante.

La creación o selección de una variante default desactiva el default activo anterior de ese ítem dentro de una transacción; el índice parcial de PostgreSQL mantiene la unicidad.

La lectura del historial de precios requiere `catalog.read`; las escrituras requieren `menu_prices.manage`.

- `GET /menu/admin/variants/{variantId}/prices`: lista el historial paginado.
- `POST /menu/admin/variants/{variantId}/prices`: crea una vigencia por sede, canal, precio, tasa y fechas.
- `GET /menu/admin/prices/{id}`: consulta una vigencia.
- `PATCH /menu/admin/prices/{id}`: corrige una vigencia sin romper las restricciones de fecha y traslape.
- `DELETE /menu/admin/prices/{id}`: desactiva una vigencia.

## Alérgenos

El catálogo global se consulta con `catalog.read`:

- `GET /menu/admin/allergens`: lista paginada y buscable `allergens`.
- `GET /menu/admin/variants/{variantId}/allergens`: consulta las declaraciones de una variante.
- `PUT /menu/admin/variants/{variantId}/allergens`: reemplaza todas las declaraciones. Requiere `catalog.manage` y registra `reviewedByUserId`/`reviewedAt` cuando `isReviewed=true`.

El reemplazo valida que no haya alérgenos repetidos y que todos estén activos; la eliminación y creación de filas se realiza dentro de una transacción.

## Disponibilidad y agotados

Las lecturas requieren `catalog.read`; las mutaciones requieren `menu_availability.manage`.

- `GET /menu/admin/variants/{variantId}/availability`: lista ventanas paginadas.
- `POST /menu/admin/variants/{variantId}/availability`: crea una ventana `HH:mm`, día ISO, canal y fechas opcionales.
- `GET /menu/admin/availability/{id}`: consulta una ventana.
- `PATCH /menu/admin/availability/{id}`: actualiza o desactiva una ventana.
- `DELETE /menu/admin/availability/{id}`: desactiva una ventana.
- `GET /menu/admin/variants/{variantId}/outages`: lista agotados paginados.
- `POST /menu/admin/variants/{variantId}/outages`: crea un agotado; el usuario autenticado queda como `createdByUserId`.
- `GET /menu/admin/outages/{id}`: consulta un agotado.
- `PATCH /menu/admin/outages/{id}`: actualiza o desactiva un agotado.
- `DELETE /menu/admin/outages/{id}`: desactiva un agotado.

Las validaciones HTTP reflejan las restricciones SQL: horarios no vacíos, `endsAt > startsAt` salvo ventanas que cruzan medianoche, vigencias coherentes y agotados con fecha final posterior a la inicial.

## Modificadores

Las lecturas requieren `catalog.read`; las mutaciones requieren `modifiers.manage`.

- `GET /menu/admin/modifier-groups`: lista paginada y buscable grupos con sus opciones.
- `GET /menu/admin/modifier-groups/{id}`: consulta un grupo.
- `POST /menu/admin/modifier-groups`: crea un grupo.
- `PATCH /menu/admin/modifier-groups/{id}`: actualiza límites, nombres o `active`.
- `DELETE /menu/admin/modifier-groups/{id}`: desactiva un grupo.
- `POST /menu/admin/modifier-groups/{groupId}/modifiers`: agrega una opción.
- `GET /menu/admin/modifiers/{id}`: consulta una opción.
- `PATCH /menu/admin/modifiers/{id}`: actualiza precio adicional, nombres o `active`.
- `DELETE /menu/admin/modifiers/{id}`: desactiva una opción.
- `PUT /menu/admin/variants/{variantId}/modifier-groups`: reemplaza y reordena los grupos de una variante en una transacción.

Los límites `selectionMin` y `selectionMax` se validan antes de persistir y respetan los `CHECK` existentes.

## Tablas usadas

El módulo consulta o escribe `locations`, `menu_categories`, `menu_items`, `menu_item_variants`, `prep_stations`, `menu_prices`, `tax_rates`, `menu_availability`, `menu_item_outages`, `allergens`, `menu_item_allergens`, `modifier_groups`, `modifiers` y `menu_item_modifier_groups`. No se modificó `prisma/schema.prisma`, `prisma/seed/seed.sql` ni `20261003120000_init`.
