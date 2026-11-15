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
  /** Paiement connu par son identifiant chez le prestataire (pour les notifications). */
  findByProviderPaymentId(
    provider: string,
    providerPaymentId: string,
  ): Promise<{ id: string; status: PaymentStatus } | null>;
  /** Enregistre l'issue et fait avancer la commande ou la réservation (fonction de la base). */
  recordResult(paymentId: string, status: PaymentStatus): Promise<void>;
}

export type CheckoutErrorCode =
  'not_found' | 'forbidden' | 'not_payable' | 'invalid_phone' | 'invalid_return_url';

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
  /** Page du site où revenir après la page de paiement hébergée (https, ou localhost en essai). */
  returnUrl?: string;
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
  if (input.returnUrl !== undefined && !isAllowedReturnUrl(input.returnUrl)) {
    throw new CheckoutError('invalid_return_url', 'Adresse de retour invalide');
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
    ...(input.returnUrl ? { returnUrl: input.returnUrl } : {}),
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
  /** Paiement Amara, ou identifiant chez le prestataire (retour de la page hébergée). */
  paymentId?: string;
  providerPaymentId?: string;
}): Promise<CheckoutResult> {
  const paymentId = input.paymentId
    ? input.paymentId
    : input.providerPaymentId
      ? (await input.store.findByProviderPaymentId(input.provider.id, input.providerPaymentId))?.id
      : undefined;
  const payment = paymentId ? await input.store.loadPayment(paymentId) : null;
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

/**
 * Suite à une notification du prestataire : on ne croit pas son contenu, on redemande
 * l'état au prestataire puis on l'enregistre. Rejouer la même notification est sans effet.
 */
export async function reconcileProviderPayment(input: {
  store: CheckoutStore;
  provider: PaymentProvider;
  providerPaymentId: string;
}): Promise<PaymentStatus | null> {
  const payment = await input.store.findByProviderPaymentId(
    input.provider.id,
    input.providerPaymentId,
  );
  if (!payment) return null;
  if (payment.status !== 'pending') return payment.status;
  return settle(input.store, input.provider, payment.id, input.providerPaymentId);
}

function isAllowedReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (value.length > 2000 || url.username || url.password) return false;
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
    );
  } catch {
    return false;
  }
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
