import { describe, expect, it } from 'vitest';
import { commissionXaf, formatXaf } from './money';

describe('formatXaf', () => {
  it('groupe les milliers et ajoute FCFA', () => {
    expect(formatXaf(1500000)).toBe('1 500 000 FCFA');
    expect(formatXaf(950)).toBe('950 FCFA');
  });

  it('arrondit au franc', () => {
    expect(formatXaf(1999.6)).toBe('2 000 FCFA');
  });

  it('refuse un montant non fini', () => {
    expect(() => formatXaf(Number.NaN)).toThrow(RangeError);
  });
});

describe('commissionXaf', () => {
  it('applique un taux en pourcentage', () => {
    expect(commissionXaf(100000, 10)).toBe(10000);
    expect(commissionXaf(12345, 7.5)).toBe(926);
  });

  it('refuse un taux hors de 0 à 100', () => {
    expect(() => commissionXaf(1000, 120)).toThrow(RangeError);
  });
});
