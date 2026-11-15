import type { MerchantWithReview } from '@amara/api';
import { useTranslation } from '@amara/i18n';
import { Arch, colors, space, Text } from '@amara/ui';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { archTint } from './labels';

const KIND_KEY = {
  artisan: 'kindArtisan',
  service_provider: 'kindService',
  both: 'kindBoth',
} as const;

export function MerchantCard({
  merchant,
  width = 160,
}: {
  merchant: MerchantWithReview;
  width?: number;
}) {
  const { t } = useTranslation('merchant');
  return (
    <Link href={{ pathname: '/boutique/[slug]', params: { slug: merchant.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [{ width, gap: space.sm }, pressed && { opacity: 0.8 }]}
      >
        <Arch width={width} height={width * 1.25} color={archTint(merchant.id)} />
        <View>
          <Text variant="title" style={{ fontSize: 18, lineHeight: 22 }} numberOfLines={1}>
            {merchant.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {t(KIND_KEY[merchant.kind])} · {merchant.city}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export const cardStyle = {
  backgroundColor: colors.paper,
  borderWidth: 1,
  borderColor: colors.sand,
  borderRadius: 20,
  padding: space.md - 4,
} as const;
