/**
 * Jetons de design d'Amara, issus de la planche d'identité validée.
 * Toute couleur, taille ou rayon utilisé dans les écrans vient d'ici.
 */
export const colors = {
  linen: '#F6F1EA',
  sand: '#E7DCCB',
  sandLine: '#DCCFBC',
  paper: '#FFFCF7',
  clay: '#A34A27',
  clayPressed: '#7E3518',
  olive: '#3E4A2F',
  ochre: '#C99A3E',
  ebony: '#1E1A16',
  stone: '#6E655B',
} as const;

export const fonts = {
  display: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'Manrope_500Medium',
  bodySemibold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 12, md: 20, pill: 999 } as const;

/** Hauteur minimale d'une zone tactile, pour l'accessibilité. */
export const touchTarget = 48;
