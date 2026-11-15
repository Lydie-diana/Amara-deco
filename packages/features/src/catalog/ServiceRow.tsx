import type { CatalogService } from '@amara/api';
import { formatXaf } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, space, Text } from '@amara/ui';
import { Pressable } from 'react-native';

import { useCategoryName } from './labels';

/** Un service sur fond olive, avec ses modes de réservation et son prix. `onPress` = réserver. */
export function ServiceRow({
  service,
  onPress,
}: {
  service: CatalogService;
  onPress?: () => void;
}) {
  const { t } = useTranslation('catalog');
  const categoryName = useCategoryName();
  const details = [
    service.bookingModes.map((m) => (m === 'slot' ? t('bySlot') : t('byQuote'))).join(' · '),
    service.durationMinutes ? t('duration', { minutes: service.durationMinutes }) : null,
    service.priceXaf != null ? formatXaf(service.priceXaf) : null,
    service.depositXaf ? t('deposit', { amount: formatXaf(service.depositXaf) }) : null,
  ].filter(Boolean);
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? t('book') : undefined}
      style={({ pressed }) => [
        { backgroundColor: colors.olive, borderRadius: 20, padding: space.md + 2, gap: 4 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text variant="eyebrow" style={{ color: colors.sand, fontSize: 11 }}>
        {categoryName(service.categoryId)}
      </Text>
      <Text variant="title" tone="inverse" style={{ fontSize: 18, lineHeight: 22 }}>
        {service.title}
      </Text>
      <Text variant="caption" style={{ color: colors.sand }}>
        {details.join(' · ')}
      </Text>
      {onPress ? (
        <Text variant="caption" style={{ color: colors.ochre, fontFamily: fonts.bodyBold }}>
          {t('book')} →
        </Text>
      ) : null}
    </Pressable>
  );
}
