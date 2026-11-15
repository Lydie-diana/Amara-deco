import { describe, expect, it, vi } from 'vitest';

vi.mock('./provider', () => ({ useAmaraClient: () => null }));

const { toSearchQuery } = await import('./catalog');

describe('toSearchQuery', () => {
  it('exige chaque mot, en acceptant les débuts de mots', () => {
    expect(toSearchQuery('Canapé vert')).toBe('canapé:* & vert:*');
  });

  it('ignore la ponctuation et les mots d’une lettre', () => {
    expect(toSearchQuery("masque d'ébène !")).toBe('masque:* & ébène:*');
  });

  it('neutralise les opérateurs de recherche', () => {
    expect(toSearchQuery('bois & | ! :* (test)')).toBe('bois:* & test:*');
  });

  it('renvoie null sans mot exploitable', () => {
    expect(toSearchQuery('  ! ')).toBeNull();
  });
});
