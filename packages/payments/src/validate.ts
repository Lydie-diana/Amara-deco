import type { PaymentRequest } from './types.ts';

/** Vérifie une demande avant de l'envoyer à un prestataire. */
export function assertValidRequest(request: PaymentRequest): void {
  if (!request.reference.trim()) throw new RangeError('Référence de paiement manquante');
  if (!Number.isInteger(request.amountXaf) || request.amountXaf <= 0) {
    throw new RangeError(`Montant invalide : ${request.amountXaf}`);
  }
  if (!/^\+237\d{9}$/.test(request.payerPhone)) {
    throw new RangeError(`Numéro de payeur invalide : ${request.payerPhone}`);
  }
}
