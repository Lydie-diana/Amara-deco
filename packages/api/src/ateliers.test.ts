import { describe, expect, it } from 'vitest';

import { groupStatuses, type AtelierPost } from './ateliers';

const status = (id: string, merchantId: string, publishedAt: string): AtelierPost => ({
  id,
  merchantId,
  merchant: { name: merchantId, slug: merchantId, city: 'Douala' },
  kind: 'status',
  caption: null,
  reviewStatus: 'approved',
  reviewNote: null,
  publishedAt,
  expiresAt: null,
  createdAt: publishedAt,
  media: [],
});

describe('groupStatuses', () => {
  it('regroupe par boutique, la plus récente en premier, statuts dans l’ordre chronologique', () => {
    const groups = groupStatuses([
      status('3', 'b', '2026-11-15T12:00:00Z'),
      status('2', 'a', '2026-11-15T11:00:00Z'),
      status('1', 'b', '2026-11-15T09:00:00Z'),
    ]);
    expect(groups.map((g) => g.merchantId)).toEqual(['b', 'a']);
    expect(groups[0]!.statuses.map((s) => s.id)).toEqual(['1', '3']);
  });
});
