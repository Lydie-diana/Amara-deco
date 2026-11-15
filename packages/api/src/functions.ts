import type { AmaraClient } from './client';

/**
 * Appelle une fonction serveur Supabase. En cas d'échec, l'erreur porte le code métier
 * renvoyé dans le corps (ex. not_payable, quota_reached), sinon `fallback`.
 */
export async function invokeFunction<T>(
  db: AmaraClient,
  name: string,
  body: Record<string, unknown>,
  fallback = `${name}_failed`,
): Promise<T> {
  const { data, error } = await db.functions.invoke<T>(name, { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const detail = context
      ? ((await context.json().catch(() => null)) as { error?: string } | null)
      : null;
    throw new Error(detail?.error ?? fallback);
  }
  return data as T;
}
