import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../bootstrap.js';
import { PrismaService } from '../database/prisma.service.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests('Menú HTTP con Fastify inject', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_CONNECT_ON_BOOT = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString('base64');
    process.env.MFA_KEY_VERSION = '1';

    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve la carta pública agrupada y un detalle por slug', async () => {
    const list = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/menu?locationId=20000000-0000-0000-0000-000000000001&category=coffee',
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      locationId: '20000000-0000-0000-0000-000000000001',
      channel: 'web',
      categories: expect.any(Array),
    });

    const detail = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/menu/items/latte?locationId=20000000-0000-0000-0000-000000000001',
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ item: { slug: 'latte' } });
  });
});
