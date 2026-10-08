import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../bootstrap.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests('Eventos HTTP con Fastify inject', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_CONNECT_ON_BOOT = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString('base64');
    process.env.MFA_KEY_VERSION = '1';
    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista el catálogo público de eventos sin exponer costos', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/events/catalog?locationId=20000000-0000-0000-0000-000000000001',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      locationId: '20000000-0000-0000-0000-000000000001',
      spaces: expect.any(Array),
      packages: expect.any(Array),
    });
    expect(response.json().packages[0]).not.toHaveProperty('basePrice');
  });
});
