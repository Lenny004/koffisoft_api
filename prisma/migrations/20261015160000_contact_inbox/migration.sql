-- Bloque 3: bandeja de contacto y conversiones.
-- Expand-only: conserva los mensajes y estados existentes; el archivado es
-- explícito y permite ocultar mensajes sin alterar su historial operativo.

ALTER TABLE contact_messages
    ADD COLUMN archived_at timestamptz(3),
    ADD COLUMN archived_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX contact_messages_location_status_received_idx
    ON contact_messages (location_id, status, received_at);

CREATE INDEX contact_messages_location_received_idx
    ON contact_messages (location_id, received_at);

INSERT INTO permissions (id, code, description)
VALUES
    ('80000000-0000-0000-0000-000000000055', 'contact.read', 'Consultar mensajes de contacto'),
    ('80000000-0000-0000-0000-000000000056', 'contact.manage', 'Gestionar mensajes y conversiones de contacto')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code IN ('owner', 'admin', 'manager')
  AND permissions.code IN ('contact.read', 'contact.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON COLUMN contact_messages.archived_at IS
    'Momento en que el mensaje dejó de aparecer en la bandeja activa.';
