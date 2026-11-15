import { describe, expect, it } from 'vitest';
import {
  createHoneliaPayProvider,
  createMockPaymentProvider,
  hmacSha256Hex,
  honeliaApiBase,
  PaymentConfigurationError,
  ProviderApiError,
  WebhookSignatureError,
} from './index.ts';

const request = {
  reference: 'cmd_001',
  amountXaf: 25000,
  payerPhone: '+237699123456',
  description: 'Masque en bois',
};

describe('prestataire de test', () => {
  it('crée un paiement en attente puis le règle', async () => {
    const provider = createMockPaymentProvider();
    const payment = await provider.initiate(request);
    expect(payment.status).toBe('pending');
    expect((await provider.getStatus(payment.providerPaymentId)).status).toBe('succeeded');
  });

  it('renvoie le même paiement pour une même référence', async () => {
    const provider = createMockPaymentProvider();
    const a = await provider.initiate(request);
    const b = await provider.initiate(request);
    expect(b.providerPaymentId).toBe(a.providerPaymentId);
  });

  it('refuse un montant à virgule ou un numéro étranger', async () => {
    const provider = createMockPaymentProvider();
    await expect(provider.initiate({ ...request, amountXaf: 10.5 })).rejects.toThrow(RangeError);
    await expect(provider.initiate({ ...request, payerPhone: '+33612345678' })).rejects.toThrow(
      RangeError,
    );
  });
});

describe('Honelia Pay', () => {
  const config = {
    baseUrl: 'https://pay.honelia.test/',
    publicKey: 'pk_test_1',
    secretKey: 'sk_test_1',
    webhookSecret: 'whsec_1',
  };

  /** Faux serveur Honelia : garde chaque appel et répond avec la session demandée. */
  function fakeApi(status = 'open', httpStatus = 201) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify(
          httpStatus >= 400
            ? { error: 'NO_RAIL_CONNECTED' }
            : {
                id: 'cs_abc',
                url: 'https://pay.honelia.test/checkout/cs_abc',
                status,
                amount: 25000,
                metadata: { reference: 'cmd_001' },
              },
        ),
        { status: httpStatus, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;
    return { calls, provider: createHoneliaPayProvider(config, fetchImpl) };
  }

  it('exige l’adresse et les deux clés', () => {
    expect(() => createHoneliaPayProvider({ baseUrl: '', secretKey: '' })).toThrow(
      PaymentConfigurationError,
    );
    expect(() =>
      createHoneliaPayProvider({ baseUrl: 'https://pay.honelia.test', secretKey: 'sk' }),
    ).toThrow(PaymentConfigurationError);
  });

  it('ajoute /api/v1 seulement s’il manque', () => {
    expect(honeliaApiBase('https://pay.honelia.test/')).toBe('https://pay.honelia.test/api/v1');
    expect(honeliaApiBase('https://pay.honelia.test/api/v1')).toBe(
      'https://pay.honelia.test/api/v1',
    );
  });

  it('ouvre une session de paiement hébergée', async () => {
    const { calls, provider } = fakeApi();
    const payment = await provider.initiate({ ...request, returnUrl: 'https://amara.cm/r' });
    expect(payment).toEqual({
      providerPaymentId: 'cs_abc',
      reference: 'cmd_001',
      amountXaf: 25000,
      status: 'pending',
      checkoutUrl: 'https://pay.honelia.test/checkout/cs_abc',
    });
    const [call] = calls;
    expect(call!.url).toBe('https://pay.honelia.test/api/v1/checkout/sessions');
    expect(call!.init.method).toBe('POST');
    expect(call!.init.headers).toMatchObject({
      'X-API-Key': 'pk_test_1',
      'X-API-Secret': 'sk_test_1',
      'Idempotency-Key': 'cmd_001',
    });
    expect(JSON.parse(String(call!.init.body))).toEqual({
      amount: 25000,
      currency: 'XAF',
      description: 'Masque en bois',
      metadata: { reference: 'cmd_001' },
      successUrl: 'https://amara.cm/r',
      cancelUrl: 'https://amara.cm/r',
    });
  });

  it.each([
    ['open', 'pending'],
    ['completed', 'succeeded'],
    ['expired', 'failed'],
    ['canceled', 'cancelled'],
  ])('traduit l’état %s', async (status, expected) => {
    const { calls, provider } = fakeApi(status, 200);
    expect((await provider.getStatus('cs_abc')).status).toBe(expected);
    expect(calls[0]!.url).toBe('https://pay.honelia.test/api/v1/checkout/sessions/cs_abc');
  });

  it('remonte le code d’erreur de l’API', async () => {
    const { provider } = fakeApi('open', 409);
    await expect(provider.initiate(request)).rejects.toMatchObject({
      code: 'NO_RAIL_CONNECTED',
      httpStatus: 409,
    });
    await expect(provider.initiate(request)).rejects.toBeInstanceOf(ProviderApiError);
  });

  describe('notifications', () => {
    const body = JSON.stringify({
      id: 'evt_1',
      type: 'payment.succeeded',
      data: { id: 'pay_1', checkoutSessionId: 'cs_abc' },
    });
    const signed = async (rawBody: string, timestamp = Math.floor(Date.now() / 1000)) =>
      new Headers({
        'X-Honelia-Timestamp': String(timestamp),
        'X-Honelia-Signature': `sha256=${await hmacSha256Hex(config.webhookSecret, `${timestamp}.${rawBody}`)}`,
      });

    it('accepte une notification signée et renvoie la session à revérifier', async () => {
      const { provider } = fakeApi();
      await expect(
        provider.readWebhook!({ headers: await signed(body), rawBody: body }),
      ).resolves.toEqual({ eventId: 'evt_1', providerPaymentId: 'cs_abc' });
      const expired = JSON.stringify({
        id: 'evt_2',
        type: 'checkout.expired',
        data: { id: 'cs_z' },
      });
      await expect(
        provider.readWebhook!({ headers: await signed(expired), rawBody: expired }),
      ).resolves.toEqual({ eventId: 'evt_2', providerPaymentId: 'cs_z' });
    });

    it('ignore un paiement direct sans session', async () => {
      const { provider } = fakeApi();
      const direct = JSON.stringify({
        id: 'evt_3',
        type: 'payment.failed',
        data: { id: 'pay_2', checkoutSessionId: null },
      });
      await expect(
        provider.readWebhook!({ headers: await signed(direct), rawBody: direct }),
      ).resolves.toBeNull();
    });

    it('refuse une signature fausse, un corps modifié ou une notification ancienne', async () => {
      const { provider } = fakeApi();
      const headers = await signed(body);
      await expect(
        provider.readWebhook!({ headers, rawBody: body.replace('cs_abc', 'cs_bad') }),
      ).rejects.toBeInstanceOf(WebhookSignatureError);
      await expect(
        provider.readWebhook!({
          headers: await signed(body, Math.floor(Date.now() / 1000) - 600),
          rawBody: body,
        }),
      ).rejects.toBeInstanceOf(WebhookSignatureError);
      const noSecret = createHoneliaPayProvider({ ...config, webhookSecret: undefined });
      await expect(noSecret.readWebhook!({ headers, rawBody: body })).rejects.toBeInstanceOf(
        WebhookSignatureError,
      );
    });
  });
});
