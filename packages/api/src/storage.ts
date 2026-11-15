/**
 * Sur le web, Supabase garde la session dans le localStorage du navigateur.
 * Pendant le rendu serveur, il n'y a pas de navigateur : on ne garde rien.
 * La version mobile de ce fichier est storage.native.ts.
 */
export const sessionStorage = undefined;
export const canPersistSession = typeof window !== 'undefined';

/** Petit stockage clé-valeur (panier…) : localStorage du navigateur, rien pendant le rendu serveur. */
export const keyValueStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {
      // Stockage indisponible (navigation privée) : le panier reste en mémoire.
    }
  },
};
