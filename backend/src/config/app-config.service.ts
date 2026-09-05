import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppConfig,
  DatabaseConfig,
  DomainConfig,
  HttpConfig,
  MqttConfig,
  SecretsConfig,
  SourcesConfig,
} from './configuration';

// Typed accessor over Nest's ConfigService so the rest of the app never touches `process.env`
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get port(): number {
    return this.config.get('port', { infer: true });
  }

  get database(): DatabaseConfig {
    return this.config.get('database', { infer: true });
  }

  get secrets(): SecretsConfig {
    return this.config.get('secrets', { infer: true });
  }

  get domain(): DomainConfig {
    return this.config.get('domain', { infer: true });
  }

  get sources(): SourcesConfig {
    return this.config.get('sources', { infer: true });
  }

  get http(): HttpConfig {
    return this.config.get('http', { infer: true });
  }

  get mqtt(): MqttConfig {
    return this.config.get('mqtt', { infer: true });
  }
}
