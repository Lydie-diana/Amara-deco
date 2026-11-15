import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { pickLocale } from './index';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('traductions', () => {
  it('ont les mêmes clés en français et en anglais', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});

describe('pickLocale', () => {
  it('prend la première langue prise en charge', () => {
    expect(pickLocale(['en-CM', 'fr-CM'])).toBe('en');
    expect(pickLocale(['de-DE', 'fr-FR'])).toBe('fr');
  });

  it('se rabat sur le français', () => {
    expect(pickLocale([])).toBe('fr');
    expect(pickLocale([null, 'es'])).toBe('fr');
  });
});
