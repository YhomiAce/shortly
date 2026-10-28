import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_PREFIX = 'shk_';
const DISPLAY_PREFIX_LENGTH = 12;

/** A freshly generated API key; `plaintext` is shown to the user exactly once. */
export interface GeneratedApiKey {
  plaintext: string;
  hash: string;
  prefix: string;
}

/** Returns the hex SHA-256 digest used to store and look up API keys. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Generates a new random API key (`shk_` + 32 random bytes, base64url). */
export function generateApiKey(): GeneratedApiKey {
  const plaintext = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** Compares two keys in constant time (by hashing both to a fixed length). */
export function apiKeysEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(hashApiKey(a), 'hex'), Buffer.from(hashApiKey(b), 'hex'));
}

/** Extracts the token from an `Authorization: Bearer <token>` header value. */
export function parseBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}
