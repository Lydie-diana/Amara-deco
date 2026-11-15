// Fonction « payments-webhook » : reçoit les notifications signées du prestataire (Honelia Pay).
// Elle est appelée par le prestataire, sans compte Amara : déployée sans vérification de jeton,
// elle n'accepte que des notifications dont la signature est valide. Elle ne croit pas leur
// contenu : elle redemande l'état du paiement au prestataire avant de l'enregistrer.
import {
  reconcileProviderPayment,
  WebhookSignatureError,
} from '../../../packages/payments/src/index.ts';
import { providerOrNull, serverClient, supabaseStore } from '../_shared/payments.ts';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const asServer = serverClient();
  const provider = await providerOrNull(asServer);
  if (!provider?.readWebhook) return reply({ error: 'payments_not_configured' }, 503);

  // Corps brut : la signature porte sur les octets reçus, avant toute lecture JSON.
  const rawBody = await req.text();
  let notice;
  try {
    notice = await provider.readWebhook({ headers: req.headers, rawBody });
  } catch (error) {
    if (error instanceof WebhookSignatureError || error instanceof SyntaxError) {
      return reply({ error: 'invalid_signature' }, 400);
    }
    throw error;
  }
  if (!notice) return reply({ received: true });

  try {
    // Une notification n'a pas de compte utilisateur : seul le serveur lit la base.
    const store = supabaseStore(asServer, asServer);
    const status = await reconcileProviderPayment({
      store,
      provider,
      providerPaymentId: notice.providerPaymentId,
    });
    return reply({ received: true, status });
  } catch (error) {
    // Une erreur 5xx fait renvoyer la notification plus tard par le prestataire.
    console.error(error);
    return reply({ error: 'reconcile_failed' }, 502);
  }
});
