import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/koffisoft_local',
    });

    super({ adapter });
  }

  /**
   * Conecta a PostgreSQL al arranque solo si DATABASE_CONNECT_ON_BOOT está activo.
   */
  async onModuleInit(): Promise<void> {
    // La conexión queda opt-in para que health checks y tests no necesiten PostgreSQL.
    if (process.env.DATABASE_CONNECT_ON_BOOT === 'true') {
      await this.$connect();
    }
  }

  /**
   * Cierra el pool de Prisma al apagar el módulo.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
