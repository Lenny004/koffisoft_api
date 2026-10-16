-- Bloque 6: respaldos externos de PostgreSQL y uploads con retención auditable.
-- Los artefactos viven fuera de PostgreSQL; esta migración solo guarda referencias.

CREATE TYPE backup_type AS ENUM ('database', 'uploads', 'full');

CREATE TYPE backup_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'expired');

CREATE TABLE backup_jobs (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    type backup_type NOT NULL,
    status backup_status NOT NULL DEFAULT 'pending',
    size_bytes bigint,
    checksum char(64),
    storage_key varchar(500),
    expires_at timestamptz(3),
    actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL ON UPDATE NO ACTION,
    started_at timestamptz(3),
    completed_at timestamptz(3),
    error_message text,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT backup_jobs_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT backup_jobs_checksum_check CHECK (checksum IS NULL OR checksum ~ '^[a-f0-9]{64}$'),
    CONSTRAINT backup_jobs_storage_key_check CHECK (
        storage_key IS NULL OR storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(dump|tar\.gz)$'
    )
);

CREATE INDEX backup_jobs_status_created_idx ON backup_jobs (status, created_at DESC);
CREATE INDEX backup_jobs_expires_idx ON backup_jobs (expires_at);

CREATE TRIGGER backup_jobs_set_updated_at
    BEFORE UPDATE ON backup_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE backup_jobs IS
    'Referencias de respaldos almacenados fuera de PostgreSQL, con checksum y retención.';
COMMENT ON COLUMN backup_jobs.storage_key IS
    'Ruta relativa generada por la API; nunca proviene de una solicitud administrativa.';

INSERT INTO permissions (id, code, description) VALUES
    ('80000000-0000-0000-0000-000000000061', 'backups.read', 'Consultar respaldos'),
    ('80000000-0000-0000-0000-000000000062', 'backups.create', 'Generar respaldos'),
    ('80000000-0000-0000-0000-000000000063', 'backups.download', 'Descargar respaldos'),
    ('80000000-0000-0000-0000-000000000064', 'backups.delete', 'Eliminar respaldos')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code IN ('owner', 'admin')
  AND permissions.code IN ('backups.read', 'backups.create', 'backups.download', 'backups.delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;
