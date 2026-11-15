import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { canPersistSession, sessionStorage } from './storage';

export type AmaraClient = SupabaseClient;

export interface AmaraClientConfig {
  url: string | undefined;
  anonKey: string | undefined;
}

/**
 * Crée le client Supabase partagé par les trois applications.
 * Renvoie null si la configuration manque, pour que l'écran puisse le dire clairement.
 */
export function createAmaraClient({ url, anonKey }: AmaraClientConfig): AmaraClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: {
      storage: sessionStorage,
      persistSession: canPersistSession,
      autoRefreshToken: canPersistSession,
      detectSessionInUrl: false,
    },
  });
}

/** Le client, ou une erreur claire si l'application n'a pas ses clés Supabase. */
export function need(client: AmaraClient | null): AmaraClient {
  if (!client) throw new Error('not_configured');
  return client;
}
