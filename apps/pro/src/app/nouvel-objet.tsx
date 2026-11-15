import { useAddProduct, useMyMerchant } from '@amara/api';
import { parseWholeNumber } from '@amara/core';
import { BackButton, RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, Screen, space, Text, TextField } from '@amara/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { CategoryPicker } from '../components/CategoryPicker';

export default function NewProduct() {
  return (
    <RequireSession badge="PRO">
      <Screen>
        <BackButton />
        <Form />
      </Screen>
    </RequireSession>
  );
}

function Form() {
  const { t } = useTranslation('merchant');
  const { data } = useMyMerchant();
  const add = useAddProduct();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('sculpture');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [isUnique, setIsUnique] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  const priceXaf = parseWholeNumber(price);
  const stockN = isUnique ? 1 : parseWholeNumber(stock);
  const errors = {
    title: title.trim().length < 2 ? t('required') : null,
    price: priceXaf == null ? t('invalidNumber') : null,
    stock: stockN == null ? t('invalidNumber') : null,
  };

  function submit() {
    if (!data || errors.title || errors.price || errors.stock) {
      setShowErrors(true);
      return;
    }
    add.mutate(
      {
        merchantId: data.merchant.id,
        categoryId,
        title: title.trim(),
        description: description.trim() || undefined,
        priceXaf: priceXaf!,
        stock: stockN!,
        isUnique,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <Text variant="display">{t('addProduct')}</Text>
      <TextField
        label={t('title')}
        value={title}
        onChangeText={setTitle}
        error={showErrors ? errors.title : null}
      />
      <Text variant="caption" style={{ color: colors.ebony }}>
        {t('category')}
      </Text>
      <CategoryPicker kind="product" value={categoryId} onChange={setCategoryId} />
      <TextField
        label={t('description')}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        style={{ minHeight: 96, borderRadius: 20, paddingTop: 14 }}
      />
      <TextField
        label={t('price')}
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
        error={showErrors ? errors.price : null}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('unique')}</Text>
        <Switch
          value={isUnique}
          onValueChange={setIsUnique}
          accessibilityLabel={t('unique')}
          trackColor={{ true: colors.olive, false: colors.sandLine }}
        />
      </View>
      {!isUnique ? (
        <TextField
          label={t('stock')}
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
          error={showErrors ? errors.stock : null}
        />
      ) : null}
      <Button label={t('save')} onPress={submit} loading={add.isPending} />
    </View>
  );
}
