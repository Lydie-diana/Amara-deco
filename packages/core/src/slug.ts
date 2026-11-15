/** Fabrique une adresse lisible à partir d'un nom : « Atelier Nkam & Fils » → « atelier-nkam-fils ». */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Lit un entier positif saisi au clavier (« 85 000 » → 85000). Renvoie null si ce n'en est pas un. */
export function parseWholeNumber(input: string): number | null {
  const compact = input.replace(/[\s  .]/g, '');
  if (!/^\d+$/.test(compact)) return null;
  const n = Number(compact);
  return Number.isSafeInteger(n) ? n : null;
}
