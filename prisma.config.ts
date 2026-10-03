import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // El valor de respaldo permite generar y validar el cliente sin una base levantada.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/koffisoft_local',
  },
});
