import type { PaymentProvider, PaymentStatus } from './types.ts';

/**
 * Parcours de paiement d'une commande ou d'une réservation, côté serveur.
 * Ne dépend ni de Supabase ni d'un prestataire précis : la fonction « payments »
 * fournit l'accès aux données (`CheckoutStore`) et le prestataire configuré.
 */

export type PayableKind = 'order' | 'booking';

export interface PayableTarget {
  kind: PayableKind;
  id: string;
  /** Référence lisible de la commande ou de la réservation (ex. « C-7F3A9B21 »). */
  reference: string;
  /** Personne qui doit payer : l'acheteuse ou le client de la réservation. */
  payerId: string;
  status: string;
  amountDueXaf: number;
}

export interface StoredPayment {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  status: PaymentStatus;
  payerId: string;
}

export interface CheckoutStore {
  /** Lit la cible avec les droits de la personne connectée (null si invisible). */
  loadTarget(kind: PayableKind, id: string): Promise<PayableTarget | null>;
  countAttempts(kind: PayableKind, id: string): Promise<number>;
  insertPayment(row: {
    kind: PayableKind;
    targetId: string;
    provider: string;
    reference: string;
    amountXaf: number;
    payerPhone: string;
  }): Promise<string>;
  attachProviderPayment(
    paymentId: string,
    providerPaymentId: string,
    checkoutUrl: string | undefined,
  ): Promise<void>;
  loadPayment(paymentId: string): Promise<StoredPayment | null>;
  /** Enregistre l'issue et fait avancer la commande ou la réservation (fonction de la base). */
  recordResult(paymentId: string, status: PaymentStatus): Promise<void>;
}

export type CheckoutErrorCode = 'not_found' | 'forbidden' | 'not_payable' | 'invalid_phone';

export class CheckoutError extends Error {
  constructor(
    readonly code: CheckoutErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export interface CheckoutResult {
  paymentId: string;
  status: PaymentStatus;
  checkoutUrl?: string;
}

const PAYABLE_STATUS = 'awaiting_payment';

export async function startCheckout(input: {
  store: CheckoutStore;
  provider: PaymentProvider;
  userId: string;
  kind: PayableKind;
  targetId: string;
  payerPhone: string;
}): Promise<CheckoutResult> {
  const { store, provider } = input;
  const target = await store.loadTarget(input.kind, input.targetId);
  if (!target) throw new CheckoutError('not_found', 'Introuvable');
  if (target.payerId !== input.userId)
    throw new CheckoutError('forbidden', 'Paiement réservé au client');
  if (target.status !== PAYABLE_STATUS || target.amountDueXaf <= 0) {
    throw new CheckoutError('not_payable', 'Rien à payer pour le moment');
  }
  if (!/^\+237[26]\d{8}$/.test(input.payerPhone)) {
    throw new CheckoutError('invalid_phone', 'Numéro de paiement invalide');
  }

  // Une référence par tentative : un échec n'empêche pas de réessayer.
  const attempt = (await store.countAttempts(target.kind, target.id)) + 1;
  const reference = `${target.reference}-${attempt}`;
  const paymentId = await store.insertPayment({
    kind: target.kind,
    targetId: target.id,
    provider: provider.id,
    reference,
    amountXaf: target.amountDueXaf,
    payerPhone: input.payerPhone,
  });

  const initiated = await provider.initiate({
    reference,
    amountXaf: target.amountDueXaf,
    payerPhone: input.payerPhone,
    description:
      target.kind === 'order' ? `Commande ${target.reference}` : `Réservation ${target.reference}`,
  });
  await store.attachProviderPayment(paymentId, initiated.providerPaymentId, initiated.checkoutUrl);

  const status = await settle(store, provider, paymentId, initiated.providerPaymentId);
  return {
    paymentId,
    status,
    ...(initiated.checkoutUrl ? { checkoutUrl: initiated.checkoutUrl } : {}),
  };
}

/** Redemande l'état d'un paiement au prestataire (après retour de l'appli de paiement). */
export async function refreshCheckout(input: {
  store: CheckoutStore;
  provider: PaymentProvider;
  userId: string;
  paymentId: string;
}): Promise<CheckoutResult> {
  const payment = await input.store.loadPayment(input.paymentId);
  if (!payment) throw new CheckoutError('not_found', 'Paiement introuvable');
  if (payment.payerId !== input.userId)
    throw new CheckoutError('forbidden', 'Paiement réservé au client');
  if (
    payment.status !== 'pending' ||
    !payment.providerPaymentId ||
    payment.provider !== input.provider.id
  ) {
    return { paymentId: payment.id, status: payment.status };
  }
  const status = await settle(input.store, input.provider, payment.id, payment.providerPaymentId);
  return { paymentId: payment.id, status };
}

async function settle(
  store: CheckoutStore,
  provider: PaymentProvider,
  paymentId: string,
  providerPaymentId: string,
): Promise<PaymentStatus> {
  const current = await provider.getStatus(providerPaymentId);
  if (current.status !== 'pending') await store.recordResult(paymentId, current.status);
  return current.status;
}
