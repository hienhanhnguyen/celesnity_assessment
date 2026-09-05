import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ClassSerializerInterceptor, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

export interface E2ERuntime {
  databaseUrl: string;
  fixturesBaseUrl: string;
  factory: { host: string; port: number; database: string; user: string; password: string };
  container: string;
  fixturesPid: number | null;
}

const RUNTIME_FILE = resolve(__dirname, '.runtime.json');

export function loadRuntime(): E2ERuntime {
  return JSON.parse(readFileSync(RUNTIME_FILE, 'utf8')) as E2ERuntime;
}

export async function createE2EApp(): Promise<{ app: INestApplication; runtime: E2ERuntime }> {
  const runtime = loadRuntime();

  process.env.DATABASE_URL = runtime.databaseUrl;
  process.env.APP_API_BASE_URL = runtime.fixturesBaseUrl;
  process.env.SUPPLIER_CRAWLER_BASE_URL = runtime.fixturesBaseUrl;
  process.env.SECRETS_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64'); 
  process.env.STALE_THRESHOLD_MINUTES ??= '15';
  process.env.SEED_ORG_ID ??= 'org-celesnity-e2e';
  process.env.SEED_ACTOR ??= 'e2e@celesnity.local';

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.init();

  return { app, runtime };
}
