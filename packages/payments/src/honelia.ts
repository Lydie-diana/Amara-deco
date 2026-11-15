import { PaymentConfigurationError, type PaymentProvider } from './types.ts';

export interface HoneliaPayConfig {
  baseUrl: string;
  /** Clé secrète : uniquement côté serveur (fonctions Supabase), jamais dans une application. */
  secretKey: string;
}

/**
 * Adaptateur Honelia Pay.
 * Honelia Pay est en cours de développement : les appels seront écrits dès que
 * sa documentation d'API sera disponible. D'ici là, cet adaptateur refuse de
 * fonctionner plutôt que de simuler un paiement.
 */
export function createHoneliaPayProvider(config: HoneliaPayConfig): PaymentProvider {
  if (!config.baseUrl || !config.secretKey) {
    throw new PaymentConfigurationError('Honelia Pay : baseUrl et secretKey sont requis');
  }
  const notReady = (): never => {
    throw new PaymentConfigurationError(
      "Honelia Pay : l'intégration sera branchée quand l'API sera documentée",
    );
  };
  return {
    id: 'honelia-pay',
    initiate: async () => notReady(),
    getStatus: async () => notReady(),
  };
}
