export type QueryValue = string | number | boolean | undefined | null;

export function buildQuery(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

export function apiUrl(base: string, path: string, params?: Record<string, QueryValue>): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = params ? buildQuery(params) : '';
  return query ? `${trimmedBase}${normalizedPath}?${query}` : `${trimmedBase}${normalizedPath}`;
}
