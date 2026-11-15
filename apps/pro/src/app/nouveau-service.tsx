import { useAddService, useMyMerchant } from '@amara/api';
import { parseWholeNumber } from '@amara/core';
import { BackButton, RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, Screen, space, Text, TextField } from '@amara/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryPicker } from '../components/CategoryPicker';
import { ChipToggle } from '../components/ChipToggle';

type Mode = 'slot' | 'quote';

export default function NewService() {
  return (
    <RequireSession badge="PRO">
      <Screen>
        <BackButton />
        <Form />
      </Screen>
    </RequireSession>
  );
}

/** Champ numérique facultatif : vide = pas de valeur ; sinon un entier. */
function optionalNumber(raw: string): { value?: number; invalid: boolean } {
  if (!raw.trim()) return { invalid: false };
  const n = parseWholeNumber(raw);
  return n == null ? { invalid: true } : { value: n, invalid: false };
}

function Form() {
  const { t } = useTranslation('merchant');
  const { t: tc } = useTranslation('catalog');
  const { data } = useMyMerchant();
  const add = useAddService();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('decoration-interieure');
  const [modes, setModes] = useState<Mode[]>(['slot', 'quote']);
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const durationN = optionalNumber(duration);
  const priceN = optionalNumber(price);
  const depositN = optionalNumber(deposit);
  const needsDuration = modes.includes('slot');
  const errors = {
    title: title.trim().length < 2 ? t('required') : null,
    modes: modes.length === 0 ? t('required') : null,
    duration: durationN.invalid
      ? t('invalidNumber')
      : needsDuration && !durationN.value
        ? t('required')
        : null,
    price: priceN.invalid ? t('invalidNumber') : null,
    deposit: depositN.invalid ? t('invalidNumber') : null,
  };

  function submit() {
    if (!data || Object.values(errors).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    add.mutate(
      {
        merchantId: data.merchant.id,
        categoryId,
        title: title.trim(),
        description: description.trim() || undefined,
        bookingModes: modes,
        durationMinutes: needsDuration ? durationN.value : undefined,
        priceXaf: priceN.value,
        depositXaf: depositN.value,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <Text variant="display">{t('addService')}</Text>
      <TextField
        label={t('title')}
        value={title}
        onChangeText={setTitle}
        error={showErrors ? errors.title : null}
      />
      <Text variant="caption" style={{ color: colors.ebony }}>
        {t('category')}
      </Text>
      <CategoryPicker kind="service" value={categoryId} onChange={setCategoryId} />
      <TextField
        label={t('description')}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        style={{ minHeight: 96, borderRadius: 20, paddingTop: 14 }}
      />
      <Text variant="caption" style={{ color: colors.ebony }}>
        {t('bookingModes')}
      </Text>
      <ChipToggle
        value={modes}
        onChange={setModes}
        items={[
          { key: 'slot', label: tc('bySlot') },
          { key: 'quote', label: tc('byQuote') },
        ]}
      />
      {showErrors && errors.modes ? (
        <Text variant="caption" style={{ color: colors.clay }}>
          {errors.modes}
        </Text>
      ) : null}
      {needsDuration ? (
        <TextField
          label={t('durationMinutes')}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          error={showErrors ? errors.duration : null}
        />
      ) : null}
      <TextField
        label={t('price')}
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
        error={showErrors ? errors.price : null}
      />
      <TextField
        label={t('deposit')}
        value={deposit}
        onChangeText={setDeposit}
        keyboardType="number-pad"
        error={showErrors ? errors.deposit : null}
      />
      {add.isError ? (
        <Text variant="caption" style={{ color: colors.clay }}>
          {tc('error')}
        </Text>
      ) : null}
      <Button label={t('save')} onPress={submit} loading={add.isPending} />
    </View>
  );
}
