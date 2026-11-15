import { describe, expect, it } from 'vitest';
import {
  CheckoutError,
  createMockPaymentProvider,
  refreshCheckout,
  startCheckout,
  type CheckoutStore,
  type PayableTarget,
  reconcileProviderPayment,
  type PaymentProvider,
  type PaymentStatus,
  type StoredPayment,
} from './index.ts';

function memoryStore(target: PayableTarget) {
  const payments = new Map<string, StoredPayment & { reference: string; amountXaf: number }>();
  const recorded: PaymentStatus[] = [];
  const store: CheckoutStore = {
    loadTarget: async (kind, id) => (kind === target.kind && id === target.id ? target : null),
    countAttempts: async () => payments.size,
    insertPayment: async (row) => {
      const id = `p${payments.size + 1}`;
      payments.set(id, {
        id,
        provider: row.provider,
        providerPaymentId: null,
        status: 'pending',
        payerId: target.payerId,
        reference: row.reference,
        amountXaf: row.amountXaf,
      });
      return id;
    },
    attachProviderPayment: async (id, providerPaymentId) => {
      payments.get(id)!.providerPaymentId = providerPaymentId;
    },
    loadPayment: async (id) => payments.get(id) ?? null,
    findByProviderPaymentId: async (provider, providerPaymentId) =>
      [...payments.values()].find(
        (p) => p.provider === provider && p.providerPaymentId === providerPaymentId,
      ) ?? null,
    recordResult: async (id, status) => {
      payments.get(id)!.status = status;
      recorded.push(status);
      if (status === 'succeeded') target.status = 'paid';
    },
  };
  return { store, payments, recorded };
}

const order = (): PayableTarget => ({
  kind: 'order',
  id: 'o1',
  reference: 'C-ABCD1234',
  payerId: 'u1',
  status: 'awaiting_payment',
  amountDueXaf: 170000,
});

describe('startCheckout', () => {
  it('paie le montant fixé par la base et enregistre le résultat', async () => {
    const target = order();
    const { store, payments, recorded } = memoryStore(target);
    const result = await startCheckout({
      store,
      provider: createMockPaymentProvider(),
      userId: 'u1',
      kind: 'order',
      targetId: 'o1',
      payerPhone: '+237699000001',
    });
    expect(result.status).toBe('succeeded');
    expect(payments.get(result.paymentId)).toMatchObject({
      reference: 'C-ABCD1234-1',
      amountXaf: 170000,
    });
    expect(recorded).toEqual(['succeeded']);
    expect(target.status).toBe('paid');
  });

  it('numérote chaque tentative après un échec', async () => {
    const { store, payments } = memoryStore(order());
    const provider = createMockPaymentProvider({ outcome: 'failed' });
    const args = {
      store,
      provider,
      userId: 'u1',
      kind: 'order' as const,
      targetId: 'o1',
      payerPhone: '+237699000001',
    };
    await startCheckout(args);
    const second = await startCheckout(args);
    expect(second.status).toBe('failed');
    expect(payments.get(second.paymentId)?.reference).toBe('C-ABCD1234-2');
  });

  it.each([
    ['not_found', { targetId: 'autre' }],
    ['forbidden', { userId: 'u2' }],
    ['invalid_phone', { payerPhone: '0699000001' }],
    ['invalid_return_url', { returnUrl: 'javascript:alert(1)' }],
    ['invalid_return_url', { returnUrl: 'http://amara.cm/achats' }],
  ] as const)('refuse : %s', async (code, override) => {
    const { store } = memoryStore(order());
    const call = startCheckout({
      store,
      provider: createMockPaymentProvider(),
      userId: 'u1',
      kind: 'order',
      targetId: 'o1',
      payerPhone: '+237699000001',
      ...override,
    });
    await expect(call).rejects.toMatchObject({ code });
    await expect(call).rejects.toBeInstanceOf(CheckoutError);
  });

  it('refuse une cible déjà payée', async () => {
    const { store } = memoryStore({ ...order(), status: 'paid' });
    await expect(
      startCheckout({
        store,
        provider: createMockPaymentProvider(),
        userId: 'u1',
        kind: 'order',
        targetId: 'o1',
        payerPhone: '+237699000001',
      }),
    ).rejects.toMatchObject({ code: 'not_payable' });
  });
});

describe('refreshCheckout', () => {
  it('ne redemande pas un paiement déjà réglé', async () => {
    const { store } = memoryStore(order());
    const provider = createMockPaymentProvider();
    const { paymentId } = await startCheckout({
      store,
      provider,
      userId: 'u1',
      kind: 'order',
      targetId: 'o1',
      payerPhone: '+237699000001',
    });
    await expect(refreshCheckout({ store, provider, userId: 'u1', paymentId })).resolves.toEqual({
      paymentId,
      status: 'succeeded',
    });
    await expect(
      refreshCheckout({ store, provider, userId: 'u2', paymentId }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

/** Prestataire à page hébergée : en attente tant que le payeur n'a pas fini. */
function hostedProvider() {
  let status: PaymentStatus = 'pending';
  const seen: { returnUrl?: string }[] = [];
  const provider: PaymentProvider = {
    id: 'hosted',
    initiate: async (r) => {
      seen.push({ returnUrl: r.returnUrl });
      return { ...r, providerPaymentId: 'cs_1', status, checkoutUrl: 'https://pay.test/cs_1' };
    },
    getStatus: async (id) => ({ providerPaymentId: id, reference: '', amountXaf: 0, status }),
  };
  return { provider, seen, setStatus: (s: PaymentStatus) => (status = s) };
}

describe('reconcileProviderPayment', () => {
  it('enregistre l’issue revérifiée, une seule fois', async () => {
    const { store, recorded } = memoryStore(order());
    const hosted = hostedProvider();
    const started = await startCheckout({
      store,
      provider: hosted.provider,
      userId: 'u1',
      kind: 'order',
      targetId: 'o1',
      payerPhone: '+237699000001',
      returnUrl: 'https://amara.cm/achats/commande/o1',
    });
    expect(started).toMatchObject({ status: 'pending', checkoutUrl: 'https://pay.test/cs_1' });
    expect(hosted.seen[0]?.returnUrl).toBe('https://amara.cm/achats/commande/o1');

    const reconcile = () =>
      reconcileProviderPayment({ store, provider: hosted.provider, providerPaymentId: 'cs_1' });
    await expect(reconcile()).resolves.toBe('pending');
    await expect(
      refreshCheckout({
        store,
        provider: hosted.provider,
        userId: 'u1',
        providerPaymentId: 'cs_1',
      }),
    ).resolves.toEqual({ paymentId: started.paymentId, status: 'pending' });
    hosted.setStatus('succeeded');
    await expect(reconcile()).resolves.toBe('succeeded');
    await expect(reconcile()).resolves.toBe('succeeded');
    expect(recorded).toEqual(['succeeded']);
    await expect(
      reconcileProviderPayment({ store, provider: hosted.provider, providerPaymentId: 'cs_x' }),
    ).resolves.toBeNull();
  });
});
