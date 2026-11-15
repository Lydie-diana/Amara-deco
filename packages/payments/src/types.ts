/**
 * Contrat que tout prestataire de paiement doit respecter.
 * Le reste d'Amara ne connaît que cette interface : changer de prestataire
 * (Honelia Pay aujourd'hui, un autre demain) ne touche que ce paquet.
 */

export interface PaymentRequest {
  /** Référence unique côté Amara (commande ou réservation). Sert aussi de clé d'idempotence. */
  reference: string;
  /** Montant en francs CFA, entier. */
  amountXaf: number;
  /** Numéro du payeur au format E.164 (+237…). */
  payerPhone: string;
  description: string;
  /** Page où renvoyer le payeur après une page de paiement hébergée (site web uniquement). */
  returnUrl?: string;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface Payment {
  /** Identifiant du paiement chez le prestataire. */
  providerPaymentId: string;
  reference: string;
  amountXaf: number;
  status: PaymentStatus;
  /** Lien ou instruction à afficher au payeur, si le prestataire en fournit. */
  checkoutUrl?: string;
}

/** Ce qu'une notification du prestataire nous apprend : quel paiement revérifier. */
export interface WebhookNotice {
  eventId: string;
  providerPaymentId: string;
}

export interface PaymentProvider {
  readonly id: string;
  initiate(request: PaymentRequest): Promise<Payment>;
  getStatus(providerPaymentId: string): Promise<Payment>;
  /**
   * Lit une notification (webhook) reçue du prestataire. Lève WebhookSignatureError si elle
   * n'est pas authentique ; renvoie null si elle ne concerne aucun paiement à suivre.
   */
  readWebhook?(input: { headers: Headers; rawBody: string }): Promise<WebhookNotice | null>;
}

export class WebhookSignatureError extends Error {
  constructor(message = 'Signature de notification invalide') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/** Erreur renvoyée par l'API du prestataire (code tel qu'il le donne, ex. NO_RAIL_CONNECTED). */
export class ProviderApiError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
  ) {
    super(`Prestataire : ${code} (${httpStatus})`);
    this.name = 'ProviderApiError';
  }
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConfigurationError';
  }
}
