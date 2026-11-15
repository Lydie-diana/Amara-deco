import { cartActions, useCart, useProduct } from '@amara/api';
import { formatXaf } from '@amara/core';
import { archTint, BackButton, QueryState, useCategoryName } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Arch, Button, colors, fonts, Screen, space, Text } from '@amara/ui';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

export default function ProductPage() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('catalog');
  const query = useProduct(id);
  const categoryName = useCategoryName();
  const { t: tcart } = useTranslation('cart');
  const cart = useCart();
  const [added, setAdded] = useState(false);

  return (
    <Screen>
      <BackButton />
      <QueryState query={query}>
        {(data) =>
          !data ? (
            <Text tone="muted">{t('notFound')}</Text>
          ) : (
            <View style={{ gap: space.md }}>
              <View style={{ alignItems: 'center' }}>
                <Arch width={250} height={300} color={archTint(data.product.id)} footRadius={20} />
              </View>
              <Text variant="eyebrow" tone="brand">
                {categoryName(data.product.category)} ·{' '}
                {data.product.isUnique
                  ? t('uniquePiece')
                  : t('inStock', { count: data.product.stock })}
              </Text>
              <Text variant="display">{data.product.title}</Text>
              <Link href={{ pathname: '/boutique/[slug]', params: { slug: data.merchant.slug } }}>
                <Text style={{ color: colors.clay, fontFamily: fonts.bodySemibold }}>
                  {data.merchant.name} · {data.merchant.city}
                </Text>
              </Link>
              {data.product.description ? <Text>{data.product.description}</Text> : null}
              <Text variant="caption" tone="muted">
                {t('deliveredByMerchant')}
              </Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 22 }}>
                {formatXaf(data.product.priceXaf)}
              </Text>
              {data.product.stock > 0 ? (
                <Button
                  label={t('addToCart')}
                  onPress={() => {
                    cartActions.add({
                      productId: data.product.id,
                      merchantId: data.merchant.id,
                      merchantName: data.merchant.name,
                      title: data.product.title,
                      unitPriceXaf: data.product.priceXaf,
                      maxQuantity: data.product.stock,
                    });
                    setAdded(true);
                  }}
                />
              ) : (
                <Text tone="muted">{tcart('soldOut')}</Text>
              )}
              {added ? (
                <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
                  <Text variant="caption" tone="muted">
                    {tcart('added')}
                  </Text>
                  <Button
                    variant="secondary"
                    label={tcart('open', { count: cart.reduce((n, l) => n + l.quantity, 0) })}
                    onPress={() => router.push('/panier')}
                  />
                </View>
              ) : null}
            </View>
          )
        }
      </QueryState>
    </Screen>
  );
}
