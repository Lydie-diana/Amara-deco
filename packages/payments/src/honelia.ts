import { assertValidRequest } from './validate.ts';
import {
  PaymentConfigurationError,
  ProviderApiError,
  WebhookSignatureError,
  type Payment,
  type PaymentProvider,
  type PaymentStatus,
} from './types.ts';

/**
 * Adaptateur Honelia Pay (API marchand v1, page de paiement hébergée).
 * Le payeur choisit son moyen (MTN MoMo, Orange Money…) sur la page Honelia ;
 * Amara suit l'issue par la session de paiement et par les notifications signées.
 */

export interface HoneliaPayConfig {
  /** Adresse de l'API, avec ou sans « /api/v1 » (ex. https://pay.honelia.cm). */
  baseUrl: string;
  /** Clé publique (pk_…), envoyée dans l'en-tête X-API-Key. */
  publicKey?: string;
  /** Clé secrète (sk_…) : lue côté serveur depuis le coffre, jamais envoyée à une application. */
  secretKey: string;
  /** Secret de signature des notifications (Développeurs › Webhooks). */
  webhookSecret?: string;
  /** « sandbox » pour les essais, « live » pour l'argent réel. */
  mode?: 'sandbox' | 'live';
}

interface HoneliaSession {
  id: string;
  url: string;
  status: 'open' | 'completed' | 'expired' | 'canceled';
  amount: number;
  metadata?: { reference?: string } | null;
}

const SESSION_STATUS: Record<HoneliaSession['status'], PaymentStatus> = {
  open: 'pending',
  completed: 'succeeded',
  expired: 'failed',
  canceled: 'cancelled',
};

/** Notifications à ignorer au-delà de cet écart d'horloge (protection contre le rejeu). */
const MAX_WEBHOOK_AGE_S = 300;

export function honeliaApiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return /\/api\/v1$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

export function createHoneliaPayProvider(
  config: HoneliaPayConfig,
  fetchImpl: typeof fetch = fetch,
): PaymentProvider {
  if (!config.baseUrl || !config.secretKey || !config.publicKey) {
    throw new PaymentConfigurationError(
      'Honelia Pay : adresse de l’API, clé publique et clé secrète sont requises',
    );
  }
  const api = honeliaApiBase(config.baseUrl);
  const headers = {
    'X-API-Key': config.publicKey,
    'X-API-Secret': config.secretKey,
    'Content-Type': 'application/json',
  };

  const call = async (path: string, init: RequestInit = {}): Promise<HoneliaSession> => {
    const response = await fetchImpl(`${api}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });
    const body = (await response.json().catch(() => null)) as
      (HoneliaSession & { error?: string }) | null;
    if (!response.ok || !body) {
      throw new ProviderApiError(body?.error ?? 'UNEXPECTED_RESPONSE', response.status);
    }
    return body;
  };

  const toPayment = (s: HoneliaSession, reference: string): Payment => ({
    providerPaymentId: s.id,
    reference: s.metadata?.reference ?? reference,
    amountXaf: s.amount,
    status: SESSION_STATUS[s.status] ?? 'pending',
    checkoutUrl: s.url,
  });

  return {
    id: 'honelia-pay',

    async initiate(request) {
      assertValidRequest(request);
      const session = await call('/checkout/sessions', {
        method: 'POST',
        // La référence Amara (une par tentative) évite tout doublon si l'appel est rejoué.
        headers: { 'Idempotency-Key': request.reference },
        body: JSON.stringify({
          amount: request.amountXaf,
          currency: 'XAF',
          description: request.description.slice(0, 200),
          metadata: { reference: request.reference },
          ...(request.returnUrl
            ? { successUrl: request.returnUrl, cancelUrl: request.returnUrl }
            : {}),
        }),
      });
      return toPayment(session, request.reference);
    },

    async getStatus(providerPaymentId) {
      const session = await call(`/checkout/sessions/${encodeURIComponent(providerPaymentId)}`);
      return toPayment(session, '');
    },

    async readWebhook({ headers: h, rawBody }) {
      if (!config.webhookSecret) throw new WebhookSignatureError('Secret des notifications absent');
      const timestamp = h.get('X-Honelia-Timestamp') ?? '';
      const signature = (h.get('X-Honelia-Signature') ?? '').replace(/^sha256=/, '');
      const age = Math.abs(Date.now() / 1000 - Number(timestamp));
      if (!/^\d+$/.test(timestamp) || !(age < MAX_WEBHOOK_AGE_S)) {
        throw new WebhookSignatureError('Notification trop ancienne');
      }
      const expected = await hmacSha256Hex(config.webhookSecret, `${timestamp}.${rawBody}`);
      if (!constantTimeEqual(expected, signature)) throw new WebhookSignatureError();

      const event = JSON.parse(rawBody) as {
        id: string;
        type: string;
        data?: { id?: string; checkoutSessionId?: string | null };
      };
      // Sessions : l'objet est la session. Paiements : la session d'où ils viennent.
      const sessionId = event.type.startsWith('checkout.')
        ? event.data?.id
        : event.type.startsWith('payment.')
          ? event.data?.checkoutSessionId
          : null;
      return sessionId ? { eventId: event.id, providerPaymentId: sessionId } : null;
    },
  };
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
