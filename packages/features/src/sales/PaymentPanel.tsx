import { useSession, useStartPayment, useRefreshPayment, type PaymentResult } from '@amara/api';
import { formatCameroonPhone, formatXaf, normalizeCameroonPhone } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { Button, colors, radius, space, Text, TextField } from '@amara/ui';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { useSalesErrorMessage } from './errors';

export interface PaymentPanelProps {
  kind: 'order' | 'booking';
  id: string;
  amountXaf: number;
}

/** Site web : la page de paiement hébergée renvoie ici avec ?session_id=… */
function webReturn(): { returnUrl?: string; sessionId?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  const { origin, pathname, search } = window.location;
  const sessionId = new URLSearchParams(search).get('session_id') ?? undefined;
  return { returnUrl: `${origin}${pathname}`, sessionId };
}

/** Ouvre la page de paiement du prestataire (même onglet sur le web). */
function openCheckout(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
  else void Linking.openURL(url);
}

/** Paiement Mobile Money d'une commande ou d'une réservation, via la fonction serveur. */
export function PaymentPanel({ kind, id, amountXaf }: PaymentPanelProps) {
  const { t } = useTranslation('sales');
  const { session } = useSession();
  const errorMessage = useSalesErrorMessage();
  const sessionPhone = normalizeCameroonPhone(session?.user.phone ?? '');
  const [phone, setPhone] = useState(sessionPhone ? formatCameroonPhone(sessionPhone) : '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const start = useStartPayment();
  const refresh = useRefreshPayment();
  const { mutate: refreshMutate } = refresh;

  // Retour de la page de paiement : on redemande l'état au serveur (jamais à l'adresse).
  useEffect(() => {
    const { sessionId } = webReturn();
    if (sessionId) refreshMutate({ sessionId }, { onSuccess: setResult });
  }, [refreshMutate]);

  const pay = () => {
    const payerPhone = normalizeCameroonPhone(phone);
    if (!payerPhone) return setPhoneError(t('invalidPhone'));
    setPhoneError(null);
    const { returnUrl } = webReturn();
    start.mutate(
      { kind, id, payerPhone, ...(returnUrl ? { returnUrl } : {}) },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.status === 'pending' && r.checkoutUrl) openCheckout(r.checkoutUrl);
        },
      },
    );
  };

  return (
    <View
      style={{
        backgroundColor: colors.sand,
        borderRadius: radius.md,
        padding: space.md,
        gap: space.md,
      }}
    >
      {result?.status === 'pending' ? (
        <>
          <Text accessibilityLiveRegion="polite">{t('paymentPending')}</Text>
          {result.checkoutUrl ? (
            <Button label={t('paymentOpen')} onPress={() => openCheckout(result.checkoutUrl!)} />
          ) : null}
          <Button
            label={t('paymentRefresh')}
            variant="secondary"
            loading={refresh.isPending}
            onPress={() =>
              refresh.mutate({ paymentId: result.paymentId }, { onSuccess: setResult })
            }
          />
        </>
      ) : (
        <>
          {result?.status === 'failed' || result?.status === 'cancelled' ? (
            <Text accessibilityLiveRegion="polite">{t('paymentFailed')}</Text>
          ) : null}
          <TextField
            label={t('payerPhone')}
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            error={phoneError}
          />
          <Button
            label={t('pay', { amount: formatXaf(amountXaf) })}
            loading={start.isPending}
            onPress={pay}
          />
          {start.error ? (
            <Text tone="muted" accessibilityLiveRegion="polite">
              {errorMessage(start.error)}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
