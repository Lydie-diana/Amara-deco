import { cartActions, groupCart, useCart, usePlaceOrder, useSession } from '@amara/api';
import { formatCameroonPhone, formatXaf, normalizeCameroonPhone } from '@amara/core';
import { BackButton, RequireSession, useSalesErrorMessage } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, fonts, Screen, space, Text, TextField } from '@amara/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

export default function Checkout() {
  return (
    <RequireSession>
      <CheckoutForm />
    </RequireSession>
  );
}

function CheckoutForm() {
  const { boutique = '' } = useLocalSearchParams<{ boutique: string }>();
  const { t } = useTranslation('sales');
  const { t: tcart } = useTranslation('cart');
  const { t: tm } = useTranslation('merchant');
  const group = groupCart(useCart()).find((g) => g.merchantId === boutique);
  const { session } = useSession();
  const sessionPhone = normalizeCameroonPhone(session?.user.phone ?? '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(sessionPhone ? formatCameroonPhone(sessionPhone) : '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const place = usePlaceOrder();
  const errorMessage = useSalesErrorMessage();

  if (!group) {
    return (
      <Screen>
        <BackButton />
        <Text tone="muted">{tcart('empty')}</Text>
      </Screen>
    );
  }

  const submit = () => {
    const contactPhone = normalizeCameroonPhone(phone);
    const next: Record<string, string> = {};
    if (city.trim().length < 2) next.city = tm('required');
    if (address.trim().length < 3) next.address = tm('required');
    if (!contactPhone) next.phone = t('invalidPhone');
    setErrors(next);
    if (Object.keys(next).length > 0 || !contactPhone) return;
    place.mutate(
      {
        merchantId: group.merchantId,
        items: group.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        deliveryCity: city.trim(),
        deliveryAddress: address.trim(),
        contactPhone,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (order) => {
          cartActions.clearMerchant(group.merchantId);
          router.replace({ pathname: '/achats/commande/[id]', params: { id: order.id } });
        },
      },
    );
  };

  return (
    <Screen>
      <BackButton />
      <Text variant="eyebrow" tone="brand">
        {group.merchantName}
      </Text>
      <Text variant="display">{t('checkoutTitle')}</Text>
      <View style={{ gap: space.xs }}>
        {group.lines.map((l) => (
          <Text key={l.productId} tone="muted">
            {l.quantity} × {l.title}
          </Text>
        ))}
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18 }}>
          {formatXaf(group.subtotalXaf)}
        </Text>
      </View>
      <TextField
        label={t('deliveryCity')}
        value={city}
        onChangeText={setCity}
        autoComplete="address-line2"
        error={errors.city}
      />
      <TextField
        label={t('deliveryAddress')}
        value={address}
        onChangeText={setAddress}
        autoComplete="street-address"
        error={errors.address}
      />
      <TextField
        label={t('contactPhone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={errors.phone}
      />
      <TextField label={t('note')} value={note} onChangeText={setNote} multiline />
      <Button label={t('placeOrder')} loading={place.isPending} onPress={submit} />
      {place.error ? (
        <Text tone="muted" accessibilityLiveRegion="polite">
          {errorMessage(place.error)}
        </Text>
      ) : null}
    </Screen>
  );
}
