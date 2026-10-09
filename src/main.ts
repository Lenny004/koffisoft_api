import 'reflect-metadata';
import 'dotenv/config';

import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { createApplication } from './bootstrap.js';

async function bootstrap(): Promise<void> {
  const app = await createApplication();

  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen({ port: config.port, host: config.host });
}

void bootstrap();
