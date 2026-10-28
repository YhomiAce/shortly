import { randomInt } from 'node:crypto';

/** Characters used for generated slugs: base58-style, without look-alikes (0/O, 1/l/I). */
export const SLUG_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

/** Length of generated slugs. 56^7 ≈ 1.7e12 combinations. */
export const GENERATED_SLUG_LENGTH = 7;

/** Custom slugs: 3-64 chars, letters/digits/`-`/`_`, starting and ending with a letter or digit. */
export const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,62}[A-Za-z0-9]$/;

/** Slugs that would clash with application routes or are confusing. Compared case-insensitively. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'health',
  'healthz',
  'docs',
  'admin',
  'dashboard',
  'login',
  'logout',
  'static',
  'assets',
  'favicon',
  'robots',
  'sitemap',
  'well-known',
]);

/** Outcome of {@link validateSlug}. */
export type SlugValidation = { valid: true } | { valid: false; reason: string };

/**
 * Generates a random slug from {@link SLUG_ALPHABET}.
 *
 * @param length - number of characters (default {@link GENERATED_SLUG_LENGTH})
 * @param nextInt - source of randomness returning an integer in `[0, max)`; injectable for tests
 */
export function generateSlug(
  length: number = GENERATED_SLUG_LENGTH,
  nextInt: (max: number) => number = (max) => randomInt(max),
): string {
  if (!Number.isInteger(length) || length < 1) throw new RangeError('length must be a positive integer');
  let slug = '';
  for (let i = 0; i < length; i += 1) slug += SLUG_ALPHABET[nextInt(SLUG_ALPHABET.length)];
  return slug;
}

/** Returns true if the slug is reserved for application routes. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Checks whether a user-supplied custom slug is acceptable. */
export function validateSlug(slug: string): SlugValidation {
  if (slug.length < 3 || slug.length > 64) return { valid: false, reason: 'Slug must be 3 to 64 characters long' };
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      reason: 'Slug may contain only letters, digits, "-" and "_", and must start and end with a letter or digit',
    };
  }
  if (isReservedSlug(slug)) return { valid: false, reason: `"${slug}" is reserved` };
  return { valid: true };
}
