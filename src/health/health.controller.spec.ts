import 'reflect-metadata';

import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';

describe('GET /health/live', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.DATABASE_CONNECT_ON_BOOT = 'false';
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.MFA_KEY_VERSION = '1';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve el estado vivo sin necesitar PostgreSQL', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'koffisoft-api',
    });
  });
});
