import { useTranslation } from '@amara/i18n';

/** Message lisible pour une erreur renvoyée par la base ou par la fonction de paiement. */
export function useSalesErrorMessage() {
  const { t } = useTranslation('sales');
  return (error: unknown): string | null => {
    if (!error) return null;
    const e = error as { code?: string; message?: string };
    if (e.message === 'invalid_phone') return t('invalidPhone');
    if (e.message === 'payments_not_configured') return t('paymentsUnavailable');
    if (e.code === 'P0001' && e.message?.startsWith('Créneau')) return t('slotTaken');
    if (e.code === 'P0001') return t('unavailable');
    return t('genericError');
  };
}
