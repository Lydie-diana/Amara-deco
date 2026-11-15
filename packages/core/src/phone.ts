/** Indicatif téléphonique du Cameroun. */
export const CAMEROON_DIAL_CODE = '237';

/**
 * Normalise un numéro camerounais au format international E.164 (+2376XXXXXXXX).
 * Accepte les espaces, tirets, points, et les préfixes +237 ou 00237.
 * Renvoie null si le numéro n'est pas un numéro camerounais à 9 chiffres valide.
 */
export function normalizeCameroonPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);

  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith(CAMEROON_DIAL_CODE)) {
    digits = digits.slice(CAMEROON_DIAL_CODE.length);
  }
  // Numéros nationaux : 9 chiffres, commençant par 6 (mobile) ou 2 (fixe).
  if (!/^[26]\d{8}$/.test(digits)) return null;
  return `+${CAMEROON_DIAL_CODE}${digits}`;
}

/** Affiche un numéro E.164 camerounais de façon lisible : +237 6 99 12 34 56. */
export function formatCameroonPhone(e164: string): string {
  const national = e164.replace(`+${CAMEROON_DIAL_CODE}`, '');
  const groups = [
    national.slice(0, 1),
    national.slice(1, 3),
    national.slice(3, 5),
    national.slice(5, 7),
    national.slice(7, 9),
  ];
  return `+${CAMEROON_DIAL_CODE} ${groups.join(' ')}`;
}
