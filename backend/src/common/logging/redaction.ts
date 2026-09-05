export const REDACTED = '***REDACTED***';

const SENSITIVE_KEY =
  /(pass(word|wd)?|secret|ciphertext|authtag|\biv\b|token|api[-_]?key|credential|connection[-_]?string)/i;

export function redactString(input: string): string {
  return input
    .replace(/\/\/([^:/@\s]+):([^@/\s]+)@/g, '//$1:***@')
    .replace(/\b(password|passwd|pwd|secret|token|apikey|api_key)\s*=\s*([^;&\s"']+)/gi, '$1=***');
}
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(val, seen);
    }
    return out;
  }
  return value;
}
