import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const KEY_BYTES = 32; // AES-256

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
}

// Decode a base64 or hex key and assert it is exactly 32 bytes
export function parseKey(key: string): Buffer {
  let buf = Buffer.from(key, 'base64');
  if (buf.length !== KEY_BYTES && /^[0-9a-fA-F]+$/.test(key)) {
    buf = Buffer.from(key, 'hex');
  }
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (base64 or hex); got ${buf.length} bytes`,
    );
  }
  return buf;
}

export function encryptSecret(plaintext: string, key: string): EncryptedSecret {
  const keyBuf = parseKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(secret: EncryptedSecret, key: string): string {
  const keyBuf = parseKey(key);
  const decipher = createDecipheriv(ALGORITHM, keyBuf, Buffer.from(secret.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(), // throws if the auth tag / key does not verify
  ]);
  return decrypted.toString('utf8');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
