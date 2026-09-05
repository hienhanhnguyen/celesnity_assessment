import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from './entities';

// DataSource only for the TypeORM CLI 

loadEnv({ path: resolve(process.cwd(), '..', '.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required to build the TypeORM DataSource for the CLI');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  entities,
  migrations: [resolve(__dirname, 'migrations', '*.{ts,js}')],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: ['error', 'warn', 'migration', 'schema'],
});
