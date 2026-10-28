import { GENERATED_SLUG_LENGTH, SLUG_ALPHABET, generateSlug, isReservedSlug, validateSlug } from './slug';

describe('generateSlug', () => {
  it('produces slugs of the default length from the safe alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const slug = generateSlug();
      expect(slug).toHaveLength(GENERATED_SLUG_LENGTH);
      for (const char of slug) expect(SLUG_ALPHABET).toContain(char);
    }
  });

  it('never uses look-alike characters', () => {
    expect(SLUG_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it('honours a custom length and randomness source', () => {
    expect(generateSlug(4, () => 0)).toBe(SLUG_ALPHABET[0].repeat(4));
    expect(generateSlug(3, (max) => max - 1)).toBe(SLUG_ALPHABET[SLUG_ALPHABET.length - 1].repeat(3));
  });

  it('generated slugs pass validation', () => {
    for (let i = 0; i < 200; i += 1) expect(validateSlug(generateSlug())).toEqual({ valid: true });
  });

  it('is practically collision-free', () => {
    const slugs = new Set(Array.from({ length: 5000 }, () => generateSlug()));
    expect(slugs.size).toBe(5000);
  });

  it('rejects invalid lengths', () => {
    expect(() => generateSlug(0)).toThrow(RangeError);
    expect(() => generateSlug(2.5)).toThrow(RangeError);
  });
});

describe('validateSlug', () => {
  it.each(['abc', 'my-link', 'Launch_2026', 'a1b2c3', 'x'.repeat(64)])('accepts %p', (slug) => {
    expect(validateSlug(slug)).toEqual({ valid: true });
  });

  it.each([
    ['ab', /3 to 64/],
    ['x'.repeat(65), /3 to 64/],
    ['-abc', /letters, digits/],
    ['abc_', /letters, digits/],
    ['has space', /letters, digits/],
    ['emoji😀x', /letters, digits/],
    ['a/b/c', /letters, digits/],
    ['api', /reserved/],
    ['Health', /reserved/],
  ])('rejects %p', (slug, reason) => {
    const result = validateSlug(slug);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(reason);
  });

  it('treats reserved slugs case-insensitively', () => {
    expect(isReservedSlug('DOCS')).toBe(true);
    expect(isReservedSlug('docs-site')).toBe(false);
  });
});
