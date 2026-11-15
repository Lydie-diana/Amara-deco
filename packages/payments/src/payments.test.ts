import { describe, expect, it } from 'vitest';
import {
  createHoneliaPayProvider,
  createMockPaymentProvider,
  PaymentConfigurationError,
} from './index';

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
  it('exige une configuration', () => {
    expect(() => createHoneliaPayProvider({ baseUrl: '', secretKey: '' })).toThrow(
      PaymentConfigurationError,
    );
  });

  it('ne simule jamais un paiement tant que l’API n’est pas branchée', async () => {
    const provider = createHoneliaPayProvider({
      baseUrl: 'https://example.invalid',
      secretKey: 'x',
    });
    await expect(provider.initiate(request)).rejects.toThrow(PaymentConfigurationError);
  });
});
