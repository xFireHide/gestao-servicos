import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(','),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API ouvindo em http://localhost:${port}/api`);
}

void bootstrap();
