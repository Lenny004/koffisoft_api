-- P1: permite exigir un cambio de contrasena en el siguiente acceso.
ALTER TABLE users
    ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.must_change_password IS
    'Indica que la cuenta debe cambiar su contrasena antes de usar el resto de la API.';
