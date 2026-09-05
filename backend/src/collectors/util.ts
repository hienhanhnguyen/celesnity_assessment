import { redactString } from '../common/logging/redaction';

export function requireString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Source config is missing required string "${key}"`);
  }
  return value;
}

export function optionalString(
  config: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = config?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function optionalNumber(
  config: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const value = config?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function optionalStringList(
  config: Record<string, unknown> | null | undefined,
  key: string,
): string[] | undefined {
  const value = config?.[key];
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value as string[];
  }
  return undefined;
}

export function joinUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

export function resolveUrl(base: string, href: string): string {
  return new URL(href, base).toString();
}

export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.sort();
  return u.toString();
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertValidIdentifier(name: string, what = 'identifier'): string {
  if (typeof name !== 'string' || name.length === 0 || name.length > 63 || !IDENTIFIER.test(name)) {
    throw new Error(`Invalid SQL ${what}: ${JSON.stringify(name)}`);
  }
  return name;
}

export function quoteIdentifier(validated: string): string {
  return `"${validated}"`;
}

export function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactString(message);
}
