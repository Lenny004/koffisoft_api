-- Bloque 4: estados editoriales, fechas de vigencia y tokens de vista previa.
-- Expand-only: las filas existentes que ya eran públicas conservan su visibilidad.

DO $$
BEGIN
    CREATE TYPE publication_status AS ENUM ('draft', 'scheduled', 'published');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE important_announcements
    ADD COLUMN publication_status publication_status NOT NULL DEFAULT 'draft',
    ADD COLUMN published_at timestamptz(3),
    ADD COLUMN scheduled_at timestamptz(3),
    ADD COLUMN expires_at timestamptz(3),
    ADD COLUMN preview_token_hash char(64),
    ADD COLUMN preview_expires_at timestamptz(3);

ALTER TABLE menu_items
    ADD COLUMN publication_status publication_status NOT NULL DEFAULT 'draft',
    ADD COLUMN published_at timestamptz(3),
    ADD COLUMN scheduled_at timestamptz(3),
    ADD COLUMN expires_at timestamptz(3),
    ADD COLUMN preview_token_hash char(64),
    ADD COLUMN preview_expires_at timestamptz(3);

ALTER TABLE events
    ADD COLUMN publication_status publication_status NOT NULL DEFAULT 'draft',
    ADD COLUMN published_at timestamptz(3),
    ADD COLUMN scheduled_at timestamptz(3),
    ADD COLUMN expires_at timestamptz(3),
    ADD COLUMN preview_token_hash char(64),
    ADD COLUMN preview_expires_at timestamptz(3);

UPDATE important_announcements
SET publication_status = 'published',
    published_at = COALESCE(starts_at, created_at),
    expires_at = ends_at
WHERE active = true;

UPDATE menu_items
SET publication_status = 'published',
    published_at = created_at
WHERE active = true AND public_visible = true;

CREATE UNIQUE INDEX important_announcements_preview_token_unique
    ON important_announcements (preview_token_hash)
    WHERE preview_token_hash IS NOT NULL;

CREATE UNIQUE INDEX menu_items_preview_token_unique
    ON menu_items (preview_token_hash)
    WHERE preview_token_hash IS NOT NULL;

CREATE UNIQUE INDEX events_preview_token_unique
    ON events (preview_token_hash)
    WHERE preview_token_hash IS NOT NULL;

CREATE INDEX important_announcements_publication_idx
    ON important_announcements (location_id, publication_status, scheduled_at);

CREATE INDEX menu_items_publication_idx
    ON menu_items (publication_status, scheduled_at);

CREATE INDEX events_publication_idx
    ON events (location_id, publication_status, scheduled_at);

ALTER TABLE important_announcements
    ADD CONSTRAINT important_announcements_publication_dates_check CHECK (
        (publication_status = 'draft' AND scheduled_at IS NULL AND published_at IS NULL AND expires_at IS NULL)
        OR (publication_status = 'scheduled' AND scheduled_at IS NOT NULL AND published_at IS NULL)
        OR (publication_status = 'published' AND published_at IS NOT NULL AND scheduled_at IS NULL)
    ),
    ADD CONSTRAINT important_announcements_publication_expiry_check CHECK (
        expires_at IS NULL OR expires_at > COALESCE(scheduled_at, published_at)
    ),
    ADD CONSTRAINT important_announcements_preview_pair_check CHECK (
        (preview_token_hash IS NULL AND preview_expires_at IS NULL)
        OR (preview_token_hash IS NOT NULL AND preview_expires_at IS NOT NULL)
    );

ALTER TABLE menu_items
    ADD CONSTRAINT menu_items_publication_dates_check CHECK (
        (publication_status = 'draft' AND scheduled_at IS NULL AND published_at IS NULL AND expires_at IS NULL)
        OR (publication_status = 'scheduled' AND scheduled_at IS NOT NULL AND published_at IS NULL)
        OR (publication_status = 'published' AND published_at IS NOT NULL AND scheduled_at IS NULL)
    ),
    ADD CONSTRAINT menu_items_publication_expiry_check CHECK (
        expires_at IS NULL OR expires_at > COALESCE(scheduled_at, published_at)
    ),
    ADD CONSTRAINT menu_items_preview_pair_check CHECK (
        (preview_token_hash IS NULL AND preview_expires_at IS NULL)
        OR (preview_token_hash IS NOT NULL AND preview_expires_at IS NOT NULL)
    );

ALTER TABLE events
    ADD CONSTRAINT events_publication_dates_check CHECK (
        (publication_status = 'draft' AND scheduled_at IS NULL AND published_at IS NULL AND expires_at IS NULL)
        OR (publication_status = 'scheduled' AND scheduled_at IS NOT NULL AND published_at IS NULL)
        OR (publication_status = 'published' AND published_at IS NOT NULL AND scheduled_at IS NULL)
    ),
    ADD CONSTRAINT events_publication_expiry_check CHECK (
        expires_at IS NULL OR expires_at > COALESCE(scheduled_at, published_at)
    ),
    ADD CONSTRAINT events_preview_pair_check CHECK (
        (preview_token_hash IS NULL AND preview_expires_at IS NULL)
        OR (preview_token_hash IS NOT NULL AND preview_expires_at IS NOT NULL)
    );

COMMENT ON COLUMN important_announcements.publication_status IS
    'Estado editorial independiente de active y de la ventana operativa starts_at/ends_at.';
COMMENT ON COLUMN menu_items.publication_status IS
    'Estado editorial que controla la exposición pública del plato.';
COMMENT ON COLUMN events.publication_status IS
    'Estado editorial independiente del estado operativo del evento.';
COMMENT ON COLUMN important_announcements.preview_token_hash IS
    'Hash SHA-256 de un token opaco de un solo uso; nunca se almacena el token en claro.';

INSERT INTO permissions (id, code, description)
VALUES (
    '80000000-0000-0000-0000-000000000059',
    'content.publish',
    'Programar y publicar contenido editorial'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code IN ('owner', 'admin', 'manager')
  AND permissions.code = 'content.publish'
ON CONFLICT (role_id, permission_id) DO NOTHING;
