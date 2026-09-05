import { randomBytes } from 'crypto';
import { decryptSecret, encryptSecret, parseKey, safeEqual } from './crypto';

const KEY_B64 = randomBytes(32).toString('base64');
const KEY_HEX = randomBytes(32).toString('hex');

describe('crypto (AES-256-GCM)', () => {
  it('round-trips a secret with a base64 key', () => {
    const enc = encryptSecret('super-secret-password', KEY_B64);
    expect(decryptSecret(enc, KEY_B64)).toBe('super-secret-password');
  });

  it('round-trips a secret with a hex key', () => {
    const enc = encryptSecret('another-secret', KEY_HEX);
    expect(decryptSecret(enc, KEY_HEX)).toBe('another-secret');
  });

  it('produces a fresh IV (and therefore ciphertext) each call', () => {
    const a = encryptSecret('same-input', KEY_B64);
    const b = encryptSecret('same-input', KEY_B64);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('does not leak the plaintext into the ciphertext', () => {
    const enc = encryptSecret('plaintextmarker', KEY_B64);
    expect(enc.ciphertext).not.toContain('plaintextmarker');
  });

  it('rejects a tampered auth tag', () => {
    const enc = encryptSecret('secret', KEY_B64);
    const tampered = { ...enc, authTag: randomBytes(16).toString('base64') };
    expect(() => decryptSecret(tampered, KEY_B64)).toThrow();
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptSecret('secret', KEY_B64);
    const bytes = Buffer.from(enc.ciphertext, 'base64');
    bytes[0] ^= 0xff;
    expect(() => decryptSecret({ ...enc, ciphertext: bytes.toString('base64') }, KEY_B64)).toThrow();
  });

  it('fails to decrypt with the wrong key', () => {
    const enc = encryptSecret('secret', KEY_B64);
    const otherKey = randomBytes(32).toString('base64');
    expect(() => decryptSecret(enc, otherKey)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => parseKey('too-short')).toThrow(/32 bytes/);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('safeEqual matches equal strings and rejects others', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
