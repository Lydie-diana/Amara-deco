import { describe, expect, it } from 'vitest';
import { parseWholeNumber, slugify } from './slug';

describe('slugify', () => {
  it('retire les accents et la ponctuation', () => {
    expect(slugify('Atelier Nkam & Fils')).toBe('atelier-nkam-fils');
    expect(slugify('  Céramique d’Éséka ')).toBe('ceramique-d-eseka');
  });
  it('limite la longueur sans tiret final', () => {
    expect(slugify('a'.repeat(59) + ' bc').length).toBeLessThanOrEqual(60);
    expect(slugify('a'.repeat(59) + ' bc').endsWith('-')).toBe(false);
  });
});

describe('parseWholeNumber', () => {
  it('accepte les espaces de milliers', () => {
    expect(parseWholeNumber('85 000')).toBe(85000);
    expect(parseWholeNumber('1.500.000')).toBe(1500000);
  });
  it('refuse le reste', () => {
    expect(parseWholeNumber('')).toBeNull();
    expect(parseWholeNumber('12,5')).toBeNull();
    expect(parseWholeNumber('-3')).toBeNull();
  });
});
