import { describe, expect, it } from 'vitest';
import { ServiceSchema, isPubliclyVisible } from './schemas';

const base = {
  id: '6f1c2b0e-4c1a-4f7e-9a7e-2f1d3c4b5a69',
  merchantId: '0b8f8e1a-1d2c-4e3f-8a9b-7c6d5e4f3a21',
  title: 'Conseil en décoration',
};

describe('ServiceSchema', () => {
  it('accepte un service sur créneau et sur devis', () => {
    expect(ServiceSchema.safeParse({ ...base, bookingModes: ['slot', 'quote'] }).success).toBe(
      true,
    );
  });

  it('exige au moins un mode de réservation', () => {
    expect(ServiceSchema.safeParse({ ...base, bookingModes: [] }).success).toBe(false);
  });

  it('refuse un prix à virgule (le FCFA n’a pas de centimes)', () => {
    expect(
      ServiceSchema.safeParse({ ...base, bookingModes: ['slot'], priceXaf: 10.5 }).success,
    ).toBe(false);
  });
});

describe('isPubliclyVisible', () => {
  it('ne montre que les contenus validés', () => {
    expect(isPubliclyVisible({ reviewStatus: 'approved' })).toBe(true);
    expect(isPubliclyVisible({ reviewStatus: 'pending' })).toBe(false);
    expect(isPubliclyVisible({ reviewStatus: 'rejected' })).toBe(false);
  });
});
