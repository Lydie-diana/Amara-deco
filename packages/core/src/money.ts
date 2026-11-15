/** Le franc CFA (XAF) n'a pas de centimes : tous les montants sont des entiers. */
export type AmountXaf = number;

const NARROW_NBSP = ' ';

/** Formate un montant pour l'affichage : 1500000 → « 1 500 000 FCFA ». */
export function formatXaf(amount: AmountXaf): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Montant invalide : ${amount}`);
  }
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
  return `${sign}${digits}${NARROW_NBSP}FCFA`;
}

/** Calcule la commission d'Amara sur un montant, arrondie au franc. Le taux est en pourcentage. */
export function commissionXaf(amount: AmountXaf, ratePercent: number): AmountXaf {
  if (ratePercent < 0 || ratePercent > 100) {
    throw new RangeError(`Taux de commission invalide : ${ratePercent}`);
  }
  return Math.round((amount * ratePercent) / 100);
}
