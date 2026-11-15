import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './en';
import { fr } from './fr';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const resources = { fr, en } as const;

/** Choisit la langue d'affichage à partir des préférences de l'appareil. Français par défaut. */
export function pickLocale(
  deviceLanguageCodes: readonly (string | null | undefined)[],
): SupportedLocale {
  for (const code of deviceLanguageCodes) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'fr';
}

let initialized = false;

/** Initialise les traductions une seule fois pour toute l'application. */
export function initI18n(locale: SupportedLocale) {
  if (!initialized) {
    void i18next.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: 'fr',
      ns: Object.keys(fr),
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    initialized = true;
  }
  return i18next;
}

export { useTranslation } from 'react-i18next';
export type { Namespace, Resources } from './types';
