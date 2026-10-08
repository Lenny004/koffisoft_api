import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../bootstrap.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests('Reservas HTTP con Fastify inject', () => {
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

  it('consulta disponibilidad pública sin cookie de sesión', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: `/reservations/availability?locationId=20000000-0000-0000-0000-000000000001&date=2026-10-24&time=18:30&partySize=2`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      locationId: '20000000-0000-0000-0000-000000000001',
      timezone: 'America/El_Salvador',
      spaces: expect.any(Array),
    });
  });
});
