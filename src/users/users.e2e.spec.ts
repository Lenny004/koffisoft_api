import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../bootstrap.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests('Usuarios HTTP con Fastify inject', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_CONNECT_ON_BOOT = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString('base64');
    process.env.MFA_KEY_VERSION = '1';
    process.env.MFA_REQUIRED_ROLES = '';

    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('protege el listado administrativo con sesión y permiso', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/users/admin?page=1&pageSize=10',
    });

    expect(response.statusCode).toBe(401);
  });

  it('protege las mutaciones administrativas contra origen ausente con cookie', async () => {
    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/users/admin/00000000-0000-0000-0000-000000000001/deactivate',
        headers: { cookie: 'koffisoft_session=invalid-session-token' },
      });

    expect(response.statusCode).toBe(403);
  });
});
