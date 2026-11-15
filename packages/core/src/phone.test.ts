import { describe, expect, it } from 'vitest';
import { formatCameroonPhone, normalizeCameroonPhone } from './phone';

describe('normalizeCameroonPhone', () => {
  it.each([
    ['699123456', '+237699123456'],
    ['6 99 12 34 56', '+237699123456'],
    ['+237 699 12 34 56', '+237699123456'],
    ['00237699123456', '+237699123456'],
    ['237-699-123-456', '+237699123456'],
    ['222 23 45 67', '+237222234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCameroonPhone(input)).toBe(expected);
  });

  it.each(['', '12345', '599123456', '+33612345678', '69912345a'])('refuse %s', (input) => {
    expect(normalizeCameroonPhone(input)).toBeNull();
  });
});

describe('formatCameroonPhone', () => {
  it('regroupe les chiffres', () => {
    expect(formatCameroonPhone('+237699123456')).toBe('+237 6 99 12 34 56');
  });
});
