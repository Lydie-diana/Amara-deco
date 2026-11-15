import { useSession, useStartPayment, useRefreshPayment, type PaymentResult } from '@amara/api';
import { formatCameroonPhone, formatXaf, normalizeCameroonPhone } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { Button, colors, radius, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { useSalesErrorMessage } from './errors';

export interface PaymentPanelProps {
  kind: 'order' | 'booking';
  id: string;
  amountXaf: number;
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

  const pay = () => {
    const payerPhone = normalizeCameroonPhone(phone);
    if (!payerPhone) return setPhoneError(t('invalidPhone'));
    setPhoneError(null);
    start.mutate({ kind, id, payerPhone }, { onSuccess: setResult });
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
          <Button
            label={t('paymentRefresh')}
            variant="secondary"
            loading={refresh.isPending}
            onPress={() => refresh.mutate(result.paymentId, { onSuccess: setResult })}
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
