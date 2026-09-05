import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AppConfigService } from '../config/app-config.service';
import { entities } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: 'postgres' as const,
        url: config.database.url,
        entities,
        migrations: [resolve(__dirname, 'migrations', '*.{ts,js}')],
        migrationsRun: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error', 'warn'] as const,
      }),
    }),
  ],
})
export class DatabaseModule {}
