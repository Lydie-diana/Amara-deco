// Code commun aux fonctions de paiement : prestataire configuré et accès aux données.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import {
  createHoneliaPayProvider,
  createMockPaymentProvider,
  type CheckoutStore,
  type PaymentProvider,
} from '../../../packages/payments/src/index.ts';

/**
 * Prestataire choisi par la super admin dans Amara Admin (écran « Paiement »).
 * Les clés viennent du coffre de la base ; sans réglage, les paiements restent fermés.
 */
export async function configuredProvider(
  asServer: SupabaseClient,
): Promise<PaymentProvider | null> {
  const { data, error } = await asServer.rpc('payment_runtime_config');
  if (error) throw new Error(error.message);
  const config = (data ?? {}) as Record<string, string | null>;
  switch (config.provider) {
    case 'honelia':
      return createHoneliaPayProvider({
        baseUrl: config.baseUrl ?? '',
        secretKey: config.secretKey ?? '',
        publicKey: config.publicKey ?? '',
        webhookSecret: config.webhookSecret ?? undefined,
        mode: config.mode === 'live' ? 'live' : 'sandbox',
      });
    case 'mock':
      return createMockPaymentProvider();
    default:
      return null;
  }
}

export function supabaseStore(asUser: SupabaseClient, asServer: SupabaseClient): CheckoutStore {
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
    async findByProviderPaymentId(provider, providerPaymentId) {
      const { data, error } = await asServer
        .from('payments')
        .select('id, status')
        .eq('provider', provider)
        .eq('provider_payment_id', providerPaymentId)
        .maybeSingle();
      fail(error);
      return data;
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

/** Prestataire configuré, ou null si les paiements sont fermés ou mal réglés. */
export async function providerOrNull(asServer: SupabaseClient): Promise<PaymentProvider | null> {
  try {
    return await configuredProvider(asServer);
  } catch (error) {
    console.error(error);
    return null;
  }
}
