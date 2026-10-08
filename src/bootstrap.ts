import cookie from '@fastify/cookie';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { AuthModule } from './auth/auth.module.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { EventsModule } from './events/events.module.js';
import { AppModule } from './app.module.js';
import { MenuModule } from './menu/menu.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const config = app.get<AppConfig>(APP_CONFIG);
  const fastify = app.getHttpAdapter().getInstance();

  await fastify.register(cookie);
  app.enableCors({
    origin: [...config.corsOrigins],
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (config.nodeEnv !== 'production') {
    setupSwagger(app);
  }

  return app;
}

export function createOpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const config = app.get<AppConfig>(APP_CONFIG);
  const options = new DocumentBuilder()
    .setTitle('Koffi-Soft API')
    .setDescription('Contratos HTTP de autenticación y autorización de Koffi-Soft.')
    .setVersion('0.1.0')
    .addSecurity('sessionCookie', {
      type: 'apiKey',
      in: 'cookie',
      name: config.cookieName,
    })
    .build();

  return SwaggerModule.createDocument(app, options, {
    include: [AuthModule, MenuModule, ReservationsModule, EventsModule],
  });
}

function setupSwagger(app: NestFastifyApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);
}
