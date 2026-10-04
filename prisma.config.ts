import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'pnpm run db:seed',
  },
  datasource: {
    // El valor de respaldo permite generar y validar el cliente sin una base levantada.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/koffisoft_local',
    // Solo se usa para migrate dev y migrate diff contra el historial de migraciones.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
