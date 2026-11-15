// Fonction « payments » : lance et suit le paiement d'une commande ou d'une réservation.
// Les montants viennent de la base, jamais de l'application. Les secrets du prestataire
// (Honelia Pay) sont saisis par la super admin et lus ici depuis le coffre de la base.
//
// POST { action: "start", kind: "order" | "booking", id, payerPhone }
// POST { action: "refresh", paymentId }
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import {
  CheckoutError,
  createHoneliaPayProvider,
  createMockPaymentProvider,
  refreshCheckout,
  startCheckout,
  type CheckoutStore,
  type PaymentProvider,
} from '../../../packages/payments/src/index.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

/**
 * Prestataire choisi par la super admin dans Amara Admin (écran « Paiement »).
 * Les clés viennent du coffre de la base ; sans réglage, les paiements restent fermés.
 */
async function configuredProvider(asServer: SupabaseClient): Promise<PaymentProvider | null> {
  const { data, error } = await asServer.rpc('payment_runtime_config');
  if (error) throw new Error(error.message);
  const config = (data ?? {}) as Record<string, string | null>;
  switch (config.provider) {
    case 'honelia':
      return createHoneliaPayProvider({
        baseUrl: config.baseUrl ?? '',
        secretKey: config.secretKey ?? '',
        publicKey: config.publicKey ?? undefined,
        webhookSecret: config.webhookSecret ?? undefined,
        mode: config.mode === 'live' ? 'live' : 'sandbox',
      });
    case 'mock':
      return createMockPaymentProvider();
    default:
      return null;
  }
}

function supabaseStore(asUser: SupabaseClient, asServer: SupabaseClient): CheckoutStore {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  return {
    async loadTarget(kind, id) {
      if (kind === 'order') {
        const { data, error } = await asUser
          .from('orders')
          .select('id, reference, buyer_id, status, subtotal_xaf')
          .eq('id', id)
          .maybeSingle();
        fail(error);
        return data
          ? {
              kind,
              id: data.id,
              reference: data.reference,
              payerId: data.buyer_id,
              status: data.status,
              amountDueXaf: data.subtotal_xaf,
            }
          : null;
      }
      const { data, error } = await asUser
        .from('bookings')
        .select('id, reference, client_id, status, amount_due_xaf')
        .eq('id', id)
        .maybeSingle();
      fail(error);
      return data
        ? {
            kind,
            id: data.id,
            reference: data.reference,
            payerId: data.client_id,
            status: data.status,
            amountDueXaf: data.amount_due_xaf,
          }
        : null;
    },
    async countAttempts(kind, id) {
      const { count, error } = await asServer
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq(kind === 'order' ? 'order_id' : 'booking_id', id);
      fail(error);
      return count ?? 0;
    },
    async insertPayment(row) {
      const { data, error } = await asServer
        .from('payments')
        .insert({
          [row.kind === 'order' ? 'order_id' : 'booking_id']: row.targetId,
          provider: row.provider,
          reference: row.reference,
          amount_xaf: row.amountXaf,
          payer_phone: row.payerPhone,
        })
        .select('id')
        .single();
      fail(error);
      return data!.id as string;
    },
    async attachProviderPayment(paymentId, providerPaymentId, checkoutUrl) {
      const { error } = await asServer
        .from('payments')
        .update({ provider_payment_id: providerPaymentId, checkout_url: checkoutUrl ?? null })
        .eq('id', paymentId);
      fail(error);
    },
    async loadPayment(paymentId) {
      const { data, error } = await asUser
        .from('payments')
        .select('id, provider, provider_payment_id, status, order_id, booking_id')
        .eq('id', paymentId)
        .maybeSingle();
      fail(error);
      if (!data) return null;
      const target = data.order_id
        ? await this.loadTarget('order', data.order_id)
        : await this.loadTarget('booking', data.booking_id);
      return {
        id: data.id,
        provider: data.provider,
        providerPaymentId: data.provider_payment_id,
        status: data.status,
        payerId: target?.payerId ?? '',
      };
    },
    async recordResult(paymentId, status) {
      const { error } = await asServer.rpc('record_payment_result', {
        p_payment_id: paymentId,
        p_status: status,
      });
      fail(error);
    },
  };
}

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
  const asServer = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const provider = await configuredProvider(asServer);
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
        }),
      );
    }
    if (body.action === 'refresh') {
      return json(
        await refreshCheckout({
          store,
          provider,
          userId: auth.user.id,
          paymentId: String(body.paymentId ?? ''),
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
