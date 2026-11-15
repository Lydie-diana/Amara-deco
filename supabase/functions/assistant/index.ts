// Fonction « assistant » : le client décrit son besoin, l'assistant IA cherche dans le catalogue
// public et propose des objets, des services et des boutiques.
// La clé de l'API, le modèle et le quota sont réglés par la super admin dans Amara Admin.
//
// POST { conversation: [{ role: "user" | "assistant", text }], language: "fr" | "en" }
// → { reply, items: [{ type, id, title, priceXaf, merchant, merchantSlug, city, … }] }
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import {
  AssistantInputError,
  readConversation,
  runAssistant,
  type AssistantLanguage,
  type CatalogItem,
} from '../../../packages/ai/src/index.ts';
import { callerId, cors, json, serverClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const asServer = serverClient();
  const { data: config, error: configError } = await asServer.rpc('assistant_runtime_config');
  if (configError) console.error(configError);
  const settings = (config ?? {}) as { enabled?: boolean; model?: string; apiKey?: string };
  if (!settings.enabled || !settings.apiKey || !settings.model) {
    return json({ error: 'assistant_disabled' }, 503);
  }

  const authorization = req.headers.get('Authorization') ?? '';
  const userId = await callerId(authorization);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  let conversation;
  try {
    conversation = readConversation(body.conversation);
  } catch (error) {
    if (error instanceof AssistantInputError) return json({ error: error.code }, 400);
    throw error;
  }
  const language: AssistantLanguage = body.language === 'en' ? 'en' : 'fr';

  // Une demande coûte : chaque personne a un nombre de demandes par 24 heures.
  const { data: allowed, error: quotaError } = await asServer.rpc('assistant_take_quota', {
    p_user_id: userId,
  });
  if (quotaError) {
    console.error(quotaError);
    return json({ error: 'assistant_failed' }, 502);
  }
  if (!allowed) return json({ error: 'quota_reached' }, 429);

  const { data: categories } = await asServer
    .from('categories')
    .select('id, name_fr, name_en')
    .order('position');
  // La recherche passe par les droits de la personne : le catalogue public, rien d'autre.
  const asUser = userClient(authorization);

  try {
    const answer = await runAssistant({
      client: new Anthropic({ apiKey: settings.apiKey }),
      model: settings.model,
      language,
      categories: (categories ?? []).map((c) => ({
        id: c.id as string,
        name: (language === 'en' ? c.name_en : c.name_fr) as string,
      })),
      conversation,
      search: async (f) => {
        const { data, error } = await asUser.rpc('search_catalog', {
          p_query: f.query,
          p_kind: f.kind,
          p_category: f.category,
          p_city: f.city,
          p_max_price: f.maxPriceXaf,
          p_limit: 8,
        });
        if (error) throw new Error(error.message);
        return (data ?? []) as CatalogItem[];
      },
    });
    return json(answer);
  } catch (error) {
    console.error(error);
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'assistant_misconfigured' }, 503);
    }
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'assistant_busy' }, 429);
    return json({ error: 'assistant_failed' }, 502);
  }
});
