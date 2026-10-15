-- Bloque 1: perfil editorial por negocio y permisos para administrarlo.
-- Expand-only: no modifica ni elimina tablas existentes; locations y las tablas
-- de horarios continúan siendo la fuente de datos por sede.

CREATE TABLE business_site_profiles (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    business_id uuid NOT NULL UNIQUE,
    hero_eyebrow varchar(120) NOT NULL,
    hero_title varchar(160) NOT NULL,
    hero_description text NOT NULL,
    hero_image_url varchar(500),
    about_title varchar(160) NOT NULL,
    about_description text NOT NULL,
    about_mission text NOT NULL,
    about_vision text NOT NULL,
    about_team jsonb NOT NULL,
    social_facebook_url varchar(500),
    social_instagram_url varchar(500),
    social_tiktok_url varchar(500),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT business_site_profiles_business_fk
        FOREIGN KEY (business_id) REFERENCES businesses(id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT business_site_profiles_text_check CHECK (
        length(btrim(hero_eyebrow)) > 0
        AND length(btrim(hero_title)) > 0
        AND length(btrim(hero_description)) > 0
        AND length(btrim(about_title)) > 0
        AND length(btrim(about_description)) > 0
        AND length(btrim(about_mission)) > 0
        AND length(btrim(about_vision)) > 0
    ),
    CONSTRAINT business_site_profiles_team_array_check CHECK (
        jsonb_typeof(about_team) = 'array'
    )
);

CREATE TRIGGER business_site_profiles_set_updated_at
    BEFORE UPDATE ON business_site_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_site_profiles IS
    'Contenido editorial común del sitio público de un negocio.';
COMMENT ON COLUMN business_site_profiles.about_team IS
    'Arreglo JSONB validado por la API con nombre, rol y descripción editorial.';

INSERT INTO permissions (id, code, description)
VALUES
    ('80000000-0000-0000-0000-000000000053', 'site_content.read', 'Consultar contenido del sitio'),
    ('80000000-0000-0000-0000-000000000054', 'site_content.manage', 'Administrar contenido del sitio')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code IN ('owner', 'admin', 'manager')
  AND permissions.code IN ('site_content.read', 'site_content.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
