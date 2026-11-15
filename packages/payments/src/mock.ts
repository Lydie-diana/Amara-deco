import type { Payment, PaymentProvider, PaymentRequest } from './types.ts';
import { assertValidRequest } from './validate.ts';

/**
 * Prestataire de test : aucun argent ne circule.
 * Utilisé en développement tant que l'API Honelia Pay n'est pas disponible.
 */
export function createMockPaymentProvider(
  options: { outcome?: 'succeeded' | 'failed' } = {},
): PaymentProvider {
  const outcome = options.outcome ?? 'succeeded';
  const payments = new Map<string, Payment>();

  return {
    id: 'mock',
    async initiate(request: PaymentRequest) {
      assertValidRequest(request);
      const existing = [...payments.values()].find((p) => p.reference === request.reference);
      if (existing) return existing;
      const payment: Payment = {
        providerPaymentId: `mock_${payments.size + 1}`,
        reference: request.reference,
        amountXaf: request.amountXaf,
        status: 'pending',
      };
      payments.set(payment.providerPaymentId, payment);
      return payment;
    },
    async getStatus(providerPaymentId: string) {
      const payment = payments.get(providerPaymentId);
      if (!payment) throw new Error(`Paiement inconnu : ${providerPaymentId}`);
      const settled: Payment = { ...payment, status: outcome };
      payments.set(providerPaymentId, settled);
      return settled;
    },
  };
}
