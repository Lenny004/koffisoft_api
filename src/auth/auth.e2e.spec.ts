import 'reflect-metadata';

import { generate } from 'otplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../bootstrap.js';
import { PrismaService } from '../database/prisma.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { PasswordService } from './security/password.service.js';

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests('auth HTTP con Fastify inject', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;
  let prisma: PrismaService;
  let userId: string;
  let email: string;
  const password = 'Auth E2E Password 123!';

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_CONNECT_ON_BOOT = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
    process.env.MFA_KEY_VERSION = '1';

    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const role = await prisma.role.findFirst({ where: { code: 'viewer', active: true } });
    if (!role) {
      throw new Error('La base de TEST_DATABASE_URL debe tener el seed aplicado.');
    }

    email = `auth-e2e-${Date.now()}@example.invalid`;
    const user = await prisma.user.create({
      data: {
        username: `auth-e2e-${Date.now()}`,
        email,
        passwordHash: await new PasswordService().hash(password),
        status: UserStatus.Active,
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.authEvent.deleteMany({ where: { userId } });
      await prisma.userSession.deleteMany({ where: { userId } });
      await prisma.userMfaRecoveryCode.deleteMany({ where: { userId } });
      await prisma.userMfaFactor.deleteMany({ where: { userId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (app) {
      await app.close();
    }
  });

  it('ejecuta login, alta TOTP, recuperación de sesión, replay y logout', async () => {
    const login = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const initialCookie = cookieFrom(login.headers['set-cookie']);

    const setup = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/mfa/totp/setup',
        headers: { cookie: initialCookie, origin: 'http://localhost:5173' },
        payload: { label: 'E2E' },
      });
    expect(setup.statusCode).toBe(201);
    const uri = (setup.json() as { uri: string }).uri;
    const secret = new URL(uri).searchParams.get('secret');
    expect(secret).toBeTruthy();

    const setupCode = await generate({ secret: secret as string });
    const confirm = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/mfa/totp/confirm',
        headers: { cookie: initialCookie, origin: 'http://localhost:5173' },
        payload: { code: setupCode },
      });
    expect(confirm.statusCode).toBe(201);
    const recoveryCode = (confirm.json() as { recoveryCodes: string[] }).recoveryCodes[0];
    expect(recoveryCode).toMatch(/^[A-Z0-9]{20}$/u);

    const secondLogin = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(secondLogin.statusCode).toBe(200);
    expect(secondLogin.json()).toMatchObject({ requiresMfa: true });
    const pendingCookie = cookieFrom(secondLogin.headers['set-cookie']);

    const verifyRecovery = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/mfa/recovery',
        headers: { cookie: pendingCookie, origin: 'http://localhost:5173' },
        payload: { code: recoveryCode },
      });
    expect(verifyRecovery.statusCode).toBe(200);
    const authenticatedCookie = cookieFrom(verifyRecovery.headers['set-cookie']);

    const me = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: authenticatedCookie },
      });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ mfa: { enabled: true, verified: true } });

    const logout = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie: authenticatedCookie, origin: 'http://localhost:5173' },
      });
    expect(logout.statusCode).toBe(200);

    const replayLogin = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    const replay = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/mfa/recovery',
        headers: {
          cookie: cookieFrom(replayLogin.headers['set-cookie']),
          origin: 'http://localhost:5173',
        },
        payload: { code: recoveryCode },
      });
    expect(replay.statusCode).toBe(401);
  });

  it('rechaza una mutación con Origin externo', async () => {
    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { origin: 'https://evil.example' },
      });

    expect(response.statusCode).toBe(403);
  });

  it('responde un error genérico para una contraseña incorrecta', async () => {
    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'Wrong Password 123!' },
      });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ message: 'Credenciales inválidas.' });
  });
});

function cookieFrom(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) {
    throw new Error('La respuesta no incluyó la cookie de sesión.');
  }
  return first.split(';', 1)[0] ?? first;
}
