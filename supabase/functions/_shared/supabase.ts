// Clients Supabase des fonctions : avec les droits de la personne connectée, ou du serveur.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

export const env = (name: string) => Deno.env.get(name) ?? '';

/** Client avec les droits du serveur (jamais exposé aux applications). */
export const serverClient = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

/** Client avec les droits de la personne qui appelle (son jeton de connexion). */
export const userClient = (authorization: string) =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

/** Personne connectée qui appelle la fonction, ou null. */
export async function callerId(authorization: string): Promise<string | null> {
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await userClient(authorization).auth.getUser(token);
  return data.user?.id ?? null;
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
