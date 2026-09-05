import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AppConfigService } from './app-config.service';
import configuration from './configuration';
import { validateEnv } from './env.validation';

// Global config. Env vars come from the container environment in Docker, or from env file when running locally
// Missing values fall back to process.env, so this file is optional
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: [resolve(process.cwd(), '..', '.env'), resolve(process.cwd(), '.env')],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
