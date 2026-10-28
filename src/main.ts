import { config as loadDotenv } from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfig } from './config/env';
import { setupApp } from './setup-app';

async function bootstrap(): Promise<void> {
  loadDotenv({ quiet: true });
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app, config);
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`shortly listening on http://0.0.0.0:${config.port} (docs at /api/docs)`, 'Bootstrap');
}

void bootstrap();
