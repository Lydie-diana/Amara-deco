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

export interface PaymentProvider {
  readonly id: string;
  initiate(request: PaymentRequest): Promise<Payment>;
  getStatus(providerPaymentId: string): Promise<Payment>;
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConfigurationError';
  }
}
