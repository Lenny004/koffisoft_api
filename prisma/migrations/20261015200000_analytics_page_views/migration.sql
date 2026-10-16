-- Bloque 5: estadisticas anonimas agregadas por dia.
-- No se almacena IP, cookie, identificador de visitante ni contenido de referer.

CREATE TABLE page_views (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
    path varchar(500) NOT NULL,
    resource_type varchar(30) NOT NULL,
    resource_key varchar(160),
    referer_host varchar(255),
    occurred_at date NOT NULL,
    user_agent_family varchar(80),
    aggregate_key char(64) NOT NULL,
    view_count integer NOT NULL DEFAULT 1,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT page_views_path_check CHECK (path LIKE '/%'),
    CONSTRAINT page_views_resource_type_check CHECK (
        resource_type IN ('page', 'menu_item', 'event', 'announcement')
    ),
    CONSTRAINT page_views_view_count_check CHECK (view_count > 0),
    CONSTRAINT page_views_aggregate_key_check CHECK (aggregate_key ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX page_views_aggregate_key_unique
    ON page_views (aggregate_key);

CREATE INDEX page_views_business_date_idx
    ON page_views (business_id, occurred_at);

CREATE INDEX page_views_location_date_idx
    ON page_views (location_id, occurred_at);

CREATE INDEX page_views_path_date_idx
    ON page_views (path, occurred_at);

CREATE INDEX page_views_resource_date_idx
    ON page_views (resource_type, resource_key, occurred_at);

CREATE INDEX page_views_referer_date_idx
    ON page_views (referer_host, occurred_at);

CREATE TRIGGER page_views_set_updated_at
BEFORE UPDATE ON page_views
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE page_views IS
    'Agregados diarios de visitas publicas sin IP, cookies ni identificadores personales.';
COMMENT ON COLUMN page_views.aggregate_key IS
    'Clave SHA-256 determinista de la combinacion agregada; no identifica visitantes.';
COMMENT ON COLUMN page_views.occurred_at IS
    'Dia calendario de la sede; las filas con mas de 395 dias se purgan por la API.';
