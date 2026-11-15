import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { need } from './client';
import { invokeFunction } from './functions';
import { useAmaraClient } from './provider';

// ---------------------------------------------------------------------------
// Assistant IA (fonction serveur « assistant »)
// ---------------------------------------------------------------------------

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantItem {
  type: 'product' | 'service' | 'merchant';
  id: string;
  title: string;
  description?: string | null;
  priceXaf?: number | null;
  merchant?: string | null;
  merchantSlug: string;
  city: string;
}

export interface AssistantAnswer {
  reply: string;
  items: AssistantItem[];
}

/** Envoie la conversation (texte seulement) ; l'erreur porte un code (quota_reached…). */
export function useAskAssistant() {
  const client = useAmaraClient();
  return useMutation({
    mutationFn: (input: { conversation: AssistantTurn[]; language: 'fr' | 'en' }) =>
      invokeFunction<AssistantAnswer>(need(client), 'assistant', { ...input }),
  });
}

// ---------------------------------------------------------------------------
// Réglages, pour l'écran « Assistant » d'Amara Admin (la clé n'est jamais relue)
// ---------------------------------------------------------------------------

export interface AssistantSettings {
  enabled: boolean;
  model: string;
  dailyLimit: number;
  hasApiKey: boolean;
  updatedAt: string | null;
}

export interface AssistantSettingsInput {
  enabled: boolean;
  model: string;
  dailyLimit: number;
  /** undefined : garder la clé enregistrée ; '' : l'effacer. */
  apiKey?: string;
}

const settingsKey = ['assistant-settings'] as const;

export function useAssistantSettings() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: settingsKey,
    enabled: client != null,
    queryFn: async () => {
      const { data, error } = await need(client).rpc('admin_assistant_settings');
      if (error) throw error;
      return data as AssistantSettings;
    },
  });
}

export function useSaveAssistantSettings() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssistantSettingsInput) => {
      const { error } = await need(client).rpc('admin_set_assistant_settings', {
        p_enabled: input.enabled,
        p_model: input.model,
        p_daily_limit: input.dailyLimit,
        p_api_key: input.apiKey ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKey }),
  });
}
