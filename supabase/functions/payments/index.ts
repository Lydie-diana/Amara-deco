// Fonction « payments » : lance et suit le paiement d'une commande ou d'une réservation.
// Les montants viennent de la base, jamais de l'application. Les secrets du prestataire
// (Honelia Pay) sont saisis par la super admin et lus ici depuis le coffre de la base.
//
// POST { action: "start", kind: "order" | "booking", id, payerPhone, returnUrl? }
// POST { action: "refresh", paymentId } ou { action: "refresh", sessionId } (retour de la page
//      de paiement hébergée, qui ajoute ?session_id=… à l'adresse de retour)
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import {
  CheckoutError,
  refreshCheckout,
  startCheckout,
} from '../../../packages/payments/src/index.ts';
import { env, providerOrNull, serverClient, supabaseStore } from '../_shared/payments.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HTTP_STATUS = {
  not_found: 404,
  forbidden: 403,
  not_payable: 409,
  invalid_phone: 422,
  invalid_return_url: 422,
} as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const url = env('SUPABASE_URL');
  const asUser = createClient(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const asServer = serverClient();

  const provider = await providerOrNull(asServer);
  if (!provider) return json({ error: 'payments_not_configured' }, 503);

  const { data: auth } = await asUser.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const store = supabaseStore(asUser, asServer);
  try {
    if (body.action === 'start' && (body.kind === 'order' || body.kind === 'booking')) {
      return json(
        await startCheckout({
          store,
          provider,
          userId: auth.user.id,
          kind: body.kind,
          targetId: String(body.id ?? ''),
          payerPhone: String(body.payerPhone ?? ''),
          ...(typeof body.returnUrl === 'string' ? { returnUrl: body.returnUrl } : {}),
        }),
      );
    }
    if (body.action === 'refresh') {
      return json(
        await refreshCheckout({
          store,
          provider,
          userId: auth.user.id,
          ...(typeof body.paymentId === 'string' ? { paymentId: body.paymentId } : {}),
          ...(typeof body.sessionId === 'string' ? { providerPaymentId: body.sessionId } : {}),
        }),
      );
    }
    return json({ error: 'invalid_body' }, 400);
  } catch (error) {
    if (error instanceof CheckoutError) return json({ error: error.code }, HTTP_STATUS[error.code]);
    console.error(error);
    return json({ error: 'payment_failed' }, 502);
  }
});
