-- Alcance: conservar relaciones, requisitos y asignaciones invalidadas sin borrar filas.
-- Precondición: las tablas pertenecen a la migración inicial y no se eliminan datos existentes.
-- Estrategia expand/contract: se agregan columnas con DEFAULT true; la aplicación empieza a
-- desactivar filas y las consultas filtran las relaciones inactivas antes de cualquier limpieza.

ALTER TABLE role_permissions
    ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE user_roles
    ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE menu_item_allergens
    ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE menu_item_modifier_groups
    ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE event_requirements
    ADD COLUMN active boolean NOT NULL DEFAULT true;

CREATE INDEX menu_item_allergens_variant_active_idx
    ON menu_item_allergens (menu_item_variant_id)
    WHERE active;

CREATE INDEX menu_item_modifier_groups_variant_active_idx
    ON menu_item_modifier_groups (variant_id)
    WHERE active;

CREATE INDEX event_requirements_event_active_idx
    ON event_requirements (event_id, created_at)
    WHERE active;
