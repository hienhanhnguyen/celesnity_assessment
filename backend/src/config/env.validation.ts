import { plainToInstance } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min, validateSync } from 'class-validator';

class EnvVars {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SECRETS_ENCRYPTION_KEY!: string;

  @IsInt()
  @Min(1)
  STALE_THRESHOLD_MINUTES!: number;

  @IsString()
  @IsNotEmpty()
  SEED_ORG_ID!: string;

  @IsString()
  @IsNotEmpty()
  SEED_ACTOR!: string;

  @IsString()
  @IsNotEmpty()
  APP_API_BASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SUPPLIER_CRAWLER_BASE_URL!: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return config;
}
