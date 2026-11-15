import { normalizeCameroonPhone } from '@amara/core';
import type { Session } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useAmaraClient } from './provider';

function requirePhone(raw: string): string {
  const phone = normalizeCameroonPhone(raw);
  if (!phone) throw new RangeError('invalid_phone');
  return phone;
}

/** Envoie un code de connexion par SMS. Renvoie le numéro normalisé (+237…). */
export function useRequestOtp() {
  const client = useAmaraClient();
  return useMutation({
    mutationFn: async (rawPhone: string) => {
      if (!client) throw new Error('not_configured');
      const phone = requirePhone(rawPhone);
      const { error } = await client.auth.signInWithOtp({ phone });
      if (error) throw error;
      return phone;
    },
  });
}

/** Vérifie le code reçu par SMS et ouvre la session. */
export function useVerifyOtp() {
  const client = useAmaraClient();
  return useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      if (!client) throw new Error('not_configured');
      const { data, error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw error;
      return data.session;
    },
  });
}

/** La session en cours, mise à jour à chaque connexion ou déconnexion. */
export function useSession(): { session: Session | null; loading: boolean } {
  const client = useAmaraClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(client != null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return { session, loading };
}

export function useSignOut() {
  const client = useAmaraClient();
  return useMutation({
    mutationFn: async () => {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
  });
}
