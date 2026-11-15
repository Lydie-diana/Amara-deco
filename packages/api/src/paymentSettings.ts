import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { need } from './client';
import { useAmaraClient } from './provider';

/**
 * Réglages du prestataire de paiement, pour l'écran « Paiement » d'Amara Admin.
 * La base ne renvoie jamais les clés secrètes : seulement si elles sont enregistrées.
 */

export type PaymentProviderId = 'none' | 'mock' | 'honelia';
export type PaymentMode = 'sandbox' | 'live';

export interface PaymentSettings {
  provider: PaymentProviderId;
  mode: PaymentMode;
  baseUrl: string | null;
  publicKey: string | null;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  /** Le prestataire de test n'est proposé que sur la base de dev. */
  mockAllowed: boolean;
  updatedAt: string | null;
}

export interface PaymentSettingsInput {
  provider: PaymentProviderId;
  mode: PaymentMode;
  baseUrl: string;
  publicKey: string;
  /** undefined : garder la clé enregistrée ; '' : l'effacer. */
  secretKey?: string;
  webhookSecret?: string;
}

const key = ['payment-settings'] as const;

export function usePaymentSettings() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: key,
    enabled: client != null,
    queryFn: async () => {
      const { data, error } = await need(client).rpc('admin_payment_settings');
      if (error) throw error;
      return data as PaymentSettings;
    },
  });
}

export function useSavePaymentSettings() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentSettingsInput) => {
      const { error } = await need(client).rpc('admin_set_payment_settings', {
        p_provider: input.provider,
        p_mode: input.mode,
        p_base_url: input.baseUrl,
        p_public_key: input.publicKey,
        p_secret_key: input.secretKey ?? null,
        p_webhook_secret: input.webhookSecret ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
