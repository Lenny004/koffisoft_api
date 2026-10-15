# Trabajos en segundo plano

Los respaldos viven en `src/backups/` porque tienen un contrato administrativo,
persistencia de estado, worker idempotente y pruebas con procesos mockeados.
Otros trabajos de correo, QR y PDF deberán agregarse aquí solo cuando tengan un
contrato, persistencia y pruebas aprobadas.
