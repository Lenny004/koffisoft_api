import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../bootstrap.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests('Inventario HTTP con Fastify inject', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_CONNECT_ON_BOOT = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString('base64');
    process.env.MFA_KEY_VERSION = '1';
    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('protege la lectura de inventario con sesión y permiso', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/inventory/admin/items?locationId=20000000-0000-0000-0000-000000000001',
    });

    expect(response.statusCode).toBe(401);
  });

  it('protege las mutaciones de ajustes con sesión y CSRF', async () => {
    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/inventory/admin/movements/adjustments',
        headers: {
          origin: 'http://localhost:5173',
          referer: 'http://localhost:5173/inventario',
        },
        payload: {
          locationId: '20000000-0000-0000-0000-000000000001',
          storageLocationId: '69000000-0000-0000-0000-000000000001',
          ingredientId: '67000000-0000-0000-0000-000000000001',
          movementType: 'waste',
          quantity: '1',
          reason: 'Prueba',
        },
      });

    expect(response.statusCode).toBe(401);
  });
});
