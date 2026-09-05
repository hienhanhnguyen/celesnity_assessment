import { REDACTED, redact, redactString } from './redaction';

describe('redaction', () => {
  it('masks sensitive keys in a flat object', () => {
    const out = redact({ user: 'celesnity', password: 'hunter2', secret: 'x' }) as Record<string, unknown>;
    expect(out.user).toBe('celesnity');
    expect(out.password).toBe(REDACTED);
    expect(out.secret).toBe(REDACTED);
  });

  it('masks nested and array-held secrets', () => {
    const out = redact({
      db: { host: 'postgres', secretCiphertext: 'abc', authTag: 'zzz' },
      sources: [{ name: 'api', token: 't0ken' }],
    }) as any;
    expect(out.db.host).toBe('postgres');
    expect(out.db.secretCiphertext).toBe(REDACTED);
    expect(out.db.authTag).toBe(REDACTED);
    expect(out.sources[0].name).toBe('api');
    expect(out.sources[0].token).toBe(REDACTED);
  });

  it('masks credentials inside connection URLs', () => {
    expect(redactString('postgres://factory_readonly:s3cr3t@postgres:5432/factory')).toBe(
      'postgres://factory_readonly:***@postgres:5432/factory',
    );
  });

  it('masks key=value credential pairs in strings', () => {
    expect(redactString('host=db password=hunter2 sslmode=require')).toBe(
      'host=db password=*** sslmode=require',
    );
  });

  it('leaves non-sensitive values untouched', () => {
    const out = redact({ count: 3, station: 'WASHING', ok: true }) as Record<string, unknown>;
    expect(out).toEqual({ count: 3, station: 'WASHING', ok: true });
  });

  it('does not blow up on circular references', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const out = redact(a) as any;
    expect(out.name).toBe('a');
    expect(out.self).toBe('[Circular]');
  });
});
