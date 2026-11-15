import { cartActions, groupCart, useCart } from '@amara/api';
import { formatXaf } from '@amara/core';
import { BackButton, QuantityStepper } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, fonts, radius, Screen, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

export default function CartPage() {
  const { t } = useTranslation('cart');
  const groups = groupCart(useCart());

  return (
    <Screen>
      <BackButton />
      <Text variant="display">{t('title')}</Text>
      {groups.length === 0 ? (
        <View style={{ gap: space.md, alignItems: 'flex-start' }}>
          <Text tone="muted">{t('empty')}</Text>
          <Button label={t('browse')} variant="secondary" onPress={() => router.replace('/')} />
        </View>
      ) : (
        <>
          <Text tone="muted">{t('oneOrderPerShop')}</Text>
          {groups.map((group) => (
            <View
              key={group.merchantId}
              style={{
                backgroundColor: colors.paper,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.sand,
                padding: space.md,
                gap: space.md,
              }}
            >
              <Text variant="title" style={{ fontSize: 20 }}>
                {group.merchantName}
              </Text>
              {group.lines.map((line) => (
                <View key={line.productId} style={{ gap: space.sm }}>
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}
                  >
                    <Text style={{ flex: 1 }}>{line.title}</Text>
                    <Text style={{ fontFamily: fonts.bodyBold }}>
                      {formatXaf(line.unitPriceXaf * line.quantity)}
                    </Text>
                  </View>
                  <QuantityStepper
                    value={line.quantity}
                    max={line.maxQuantity}
                    onChange={(q) => cartActions.setQuantity(line.productId, q)}
                  />
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text tone="muted">{t('subtotal')}</Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18 }}>
                  {formatXaf(group.subtotalXaf)}
                </Text>
              </View>
              <Button
                label={t('orderFrom', { shop: group.merchantName })}
                onPress={() =>
                  router.push({
                    pathname: '/commande/[boutique]',
                    params: { boutique: group.merchantId },
                  })
                }
              />
            </View>
          ))}
          <Text variant="caption" tone="muted">
            {t('pricesChecked')}
          </Text>
        </>
      )}
    </Screen>
  );
}
