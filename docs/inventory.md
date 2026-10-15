# Inventario, proveedores, recepciones y recetas

El módulo P1 administra ingredientes, proveedores, recepciones, lotes,
movimientos y recetas usando las tablas existentes del schema Prisma. El saldo
no se guarda en una columna editable: se calcula como la suma de
`inventory_movements.quantity_delta` por ingrediente y bodega.

## Seguridad

Las rutas son administrativas y pasan por los guards globales de sesión, MFA,
CSRF y permisos. Las mutaciones también registran un `AuditLog` con datos
operativos mínimos. El actor solo puede consultar o mutar sedes del negocio
al que pertenecen sus roles activos; una sede fuera de alcance responde como
no encontrada.

| Permiso             | Uso                                                                           |
| ------------------- | ----------------------------------------------------------------------------- |
| `inventory.read`    | Catálogos, ingredientes, saldos, recepciones, movimientos, alertas y recetas. |
| `inventory.manage`  | Alta, edición y desactivación lógica de ingredientes y sus proveedores.       |
| `inventory.receive` | Recepciones, lotes y movimientos de entrada.                                  |
| `inventory.adjust`  | Ajustes positivos, ajustes negativos y mermas.                                |
| `suppliers.manage`  | CRUD de proveedores.                                                          |
| `recipes.manage`    | Crear, archivar y anotar recetas.                                             |

`suppliers.manage` se agregó al seed y se asigna a `owner`, `admin` y
`manager`. La migración del schema no cambia porque todas las tablas requeridas
ya existían.

## Endpoints

### Catálogos e ingredientes

- `GET /inventory/admin/catalog/units`
- `GET /inventory/admin/catalog/categories`
- `GET /inventory/admin/storage-locations?locationId=...`
- `GET /inventory/admin/items?locationId=...&page=1&pageSize=20&search=...`
- `GET /inventory/admin/items/:id?locationId=...`
- `POST /inventory/admin/items`
- `PATCH /inventory/admin/items/:id?locationId=...`
- `DELETE /inventory/admin/items/:id?locationId=...`

Los campos `reorderLevel`, `quantity`, `unitCost` y `quantityDelta` se
representan como cadenas decimales para conservar precisión. Las recepciones,
recetas y movimientos deben usar la unidad base del ingrediente. Las
conversiones de presentación quedan fuera de este alcance porque el schema no
contiene factores de conversión.

### Proveedores

- `GET /suppliers/admin?locationId=...&page=1&pageSize=20&search=...`
- `GET /suppliers/admin/:id?locationId=...`
- `POST /suppliers/admin`
- `PATCH /suppliers/admin/:id?locationId=...`
- `DELETE /suppliers/admin/:id?locationId=...`

El borrado es lógico (`active=false`) para preservar relaciones históricas.
Los vínculos proveedor-ingrediente se pueden reemplazar dentro del payload de
creación o actualización del ingrediente.

### Recepciones y movimientos

- `GET /inventory/admin/receipts?locationId=...&page=1&pageSize=20`
- `GET /inventory/admin/receipts/:id?locationId=...`
- `POST /inventory/admin/receipts`
- `GET /inventory/admin/movements?locationId=...&page=1&pageSize=20`
- `POST /inventory/admin/movements/adjustments`
- `GET /inventory/admin/alerts?locationId=...&expiryDays=30`

Una recepción crea atómicamente la cabecera, sus lotes, líneas y movimientos de
entrada. `locationId + receiptNumber` es la clave idempotente: repetir la misma
recepción devuelve el documento existente y no duplica stock. Un número usado
con otro proveedor produce conflicto.

Los ajustes y mermas son append-only. El cliente puede enviar `operationId`, un
UUID que se usa como `InventoryMovement.id`, para repetir una solicitud sin
crear otro movimiento. Los movimientos de salida se rechazan si el saldo
calculado quedaría negativo. En insumos con `trackLots`, una salida debe indicar
el lote; además, se valida el saldo de ese lote dentro del mismo bloqueo y nunca
puede quedar negativo aunque el saldo agregado de la bodega siga siendo
suficiente. La operación bloquea la bodega durante la transacción para
serializar entradas y salidas del módulo.

Los filtros de movimientos incluyen bodega, ingrediente, tipo y rango de
fechas. Los listados usan `page`, `pageSize` y metadatos `totalPages` y nunca
descargan el historial completo al cliente.

### Recetas

- `GET /inventory/admin/recipes`
- `GET /inventory/admin/recipes/:id?locationId=...`
- `POST /inventory/admin/recipes`
- `PATCH /inventory/admin/recipes/:id?locationId=...`
- `DELETE /inventory/admin/recipes/:id?locationId=...`

Las recetas apuntan a `MenuItemVariant`, no al producto abstracto. Cada receta
es una versión con vigencia y líneas de ingrediente. Para cambiar cantidades o
unidades se crea una nueva versión; `PATCH` y `DELETE` solo actualizan notas o
desactivan la versión existente.

## Reglas de datos

- Stock mínimo: `Ingredient.reorderLevel`.
- Stock actual: suma de movimientos por ingrediente y bodega.
- Entrada: `receipt` con delta positivo.
- Ajuste positivo: `adjustment_in`.
- Ajuste negativo: `adjustment_out`.
- Merma: `waste` con delta negativo y motivo obligatorio.
- Lotes próximos a vencer: lotes activos con saldo positivo y vencimiento
  entre hoy y la ventana solicitada.
- No se editan ni eliminan movimientos, recepciones, lotes o recetas históricas.

## Verificación

Las pruebas unitarias cubren idempotencia de recepciones y rechazo de saldos
negativos. La prueba HTTP verifica que las rutas administrativas no sean
accesibles sin sesión. Para ejecutar la suite completa:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
