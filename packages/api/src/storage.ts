/**
 * Sur le web, Supabase garde la session dans le localStorage du navigateur.
 * Pendant le rendu serveur, il n'y a pas de navigateur : on ne garde rien.
 * La version mobile de ce fichier est storage.native.ts.
 */
export const sessionStorage = undefined;
export const canPersistSession = typeof window !== 'undefined';
