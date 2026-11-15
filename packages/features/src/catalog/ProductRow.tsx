import type { CatalogProduct } from '@amara/api';
import { formatXaf } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { Arch, colors, fonts, space, Text } from '@amara/ui';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { archTint, useCategoryName } from './labels';
import { cardStyle } from './MerchantCard';

/** Un objet du catalogue. `linked` = ouvre sa fiche (application client uniquement). */
export function ProductRow({
  product,
  linked = true,
}: {
  product: CatalogProduct;
  linked?: boolean;
}) {
  const { t } = useTranslation('catalog');
  const { t: tm } = useTranslation('merchant');
  const categoryName = useCategoryName();
  const body = (
    <>
      <Arch width={72} height={90} color={archTint(product.id)} footRadius={10} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="eyebrow" tone="brand" style={{ fontSize: 11 }}>
          {categoryName(product.category)}
        </Text>
        <Text variant="title" style={{ fontSize: 18, lineHeight: 22 }} numberOfLines={2}>
          {product.title}
        </Text>
        <Text variant="caption" tone="muted">
          {product.isUnique ? t('uniquePiece') : t('inStock', { count: product.stock })}
          {product.isPublished ? '' : ` · ${tm('unpublished')}`}
        </Text>
        <Text style={{ fontFamily: fonts.bodyBold, color: colors.ebony }}>
          {formatXaf(product.priceXaf)}
        </Text>
      </View>
    </>
  );
  const rowStyle = [
    cardStyle,
    { flexDirection: 'row' as const, gap: space.md, alignItems: 'center' as const },
  ];
  if (!linked) return <View style={rowStyle}>{body}</View>;
  return (
    <Link href={{ pathname: '/objet/[id]', params: { id: product.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.8 }]}
      >
        {body}
      </Pressable>
    </Link>
  );
}
