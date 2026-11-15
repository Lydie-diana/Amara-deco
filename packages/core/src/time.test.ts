import { describe, expect, it } from 'vitest';

import { cameroonDay, cameroonInstant, formatDay, formatTime, upcomingDays } from './time';

describe('heure du Cameroun', () => {
  it('passe au jour suivant à 23 h UTC', () => {
    expect(cameroonDay(new Date('2026-11-16T22:59:00Z'))).toBe('2026-11-16');
    expect(cameroonDay(new Date('2026-11-16T23:00:00Z'))).toBe('2026-11-17');
  });

  it('liste les prochains jours', () => {
    expect(upcomingDays(3, new Date('2026-11-30T12:00:00Z'))).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
  });

  it('formate dans la langue choisie', () => {
    expect(formatTime('2026-11-17T09:30:00Z', 'fr')).toBe('10:30');
    expect(formatDay('2026-11-17', 'fr')).toMatch(/mar\.? 17 nov/);
    expect(formatDay('2026-11-17', 'en')).toMatch(/Tue 17 Nov/);
  });

  it('convertit une heure locale en instant', () => {
    expect(cameroonInstant('2026-11-17', '10:30')).toBe('2026-11-17T09:30:00.000Z');
  });
});
