-- Bloque 2: metadatos SEO editables y permisos de administración.
-- Expand-only: agrega una tabla independiente; no altera recursos publicados.

CREATE TABLE seo_metadata (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    location_id uuid REFERENCES locations(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    resource_type varchar(30) NOT NULL,
    resource_key varchar(160) NOT NULL,
    meta_title varchar(70) NOT NULL,
    meta_description varchar(160) NOT NULL,
    og_image_url varchar(500),
    canonical_url varchar(500),
    noindex boolean NOT NULL DEFAULT false,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT seo_metadata_resource_type_check CHECK (
        resource_type IN ('menu_item', 'event', 'announcement', 'page')
    ),
    CONSTRAINT seo_metadata_resource_key_check CHECK (length(btrim(resource_key)) > 0),
    CONSTRAINT seo_metadata_scope_check CHECK (
        (resource_type = 'page' AND business_id IS NOT NULL)
        OR (resource_type <> 'page' AND location_id IS NOT NULL AND business_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX seo_metadata_resource_unique
    ON seo_metadata (
        COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
        resource_type,
        resource_key
    );

CREATE INDEX seo_metadata_business_type_idx
    ON seo_metadata (business_id, resource_type);

CREATE INDEX seo_metadata_location_type_idx
    ON seo_metadata (location_id, resource_type);

CREATE TRIGGER seo_metadata_set_updated_at
    BEFORE UPDATE ON seo_metadata
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE seo_metadata IS
    'Overrides SEO por recurso; los nombres y contenidos canónicos siguen en sus tablas fuente.';
COMMENT ON COLUMN seo_metadata.resource_key IS
    'Slug, UUID o clave de página según resource_type; no duplica el recurso editorial.';

INSERT INTO permissions (id, code, description)
VALUES
    ('80000000-0000-0000-0000-000000000057', 'seo.read', 'Consultar metadatos SEO'),
    ('80000000-0000-0000-0000-000000000058', 'seo.manage', 'Administrar metadatos SEO')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code IN ('owner', 'admin', 'manager')
  AND permissions.code IN ('seo.read', 'seo.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
