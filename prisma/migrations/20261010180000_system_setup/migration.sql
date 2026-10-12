-- Alta inicial de un solo uso.
-- Precondición: la migración inicial ya creó users.
-- Estrategia: tabla nueva, sin reescritura de datos existentes.
-- El CHECK id = 1 deja una sola fila posible; el candado de la aplicación serializa el alta.

CREATE TABLE system_setups (
    id smallint PRIMARY KEY,
    completed_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_user_id uuid NOT NULL,
    CONSTRAINT system_setups_singleton_check CHECK (id = 1),
    CONSTRAINT system_setups_owner_user_id_fkey
        FOREIGN KEY (owner_user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX system_setups_owner_user_id_key ON system_setups (owner_user_id);

COMMENT ON TABLE system_setups IS 'Marca de un solo uso del primer propietario. No admite una segunda fila.';
