export interface DatabaseConfig {
  url: string;
}

export interface SecretsConfig {
  // 32 byte AES-256-GCM key, base64 or hex encoded
  encryptionKey: string;
}

export interface DomainConfig {
  staleThresholdMinutes: number;
  seedOrgId: string;
  seedActor: string;
}

export interface SourcesConfig {
  appApiBaseUrl: string;
  supplierCrawlerBaseUrl: string;
}

export interface HttpConfig {
  corsOrigins: string | string[];
}

export interface AppConfig {
  port: number;
  database: DatabaseConfig;
  secrets: SecretsConfig;
  domain: DomainConfig;
  sources: SourcesConfig;
  http: HttpConfig;
}

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const corsOrigins = (value: string | undefined): string | string[] => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '*') return '*';
  return trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export default (): AppConfig => ({
  port: int(process.env.BACKEND_PORT, 3001),
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  secrets: {
    encryptionKey: process.env.SECRETS_ENCRYPTION_KEY ?? '',
  },
  domain: {
    staleThresholdMinutes: int(process.env.STALE_THRESHOLD_MINUTES, 15),
    seedOrgId: process.env.SEED_ORG_ID ?? 'org-celesnity-001',
    seedActor: process.env.SEED_ACTOR ?? 'manager@celesnity.local',
  },
  sources: {
    appApiBaseUrl: process.env.APP_API_BASE_URL ?? 'http://localhost:4000',
    supplierCrawlerBaseUrl: process.env.SUPPLIER_CRAWLER_BASE_URL ?? 'http://localhost:4000',
  },
  http: {
    corsOrigins: corsOrigins(process.env.CORS_ORIGIN),
  },
});
