import type { StatusGroup } from '@amara/api';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, space, Text } from '@amara/ui';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { archTint } from '../catalog/labels';
import { StatusViewer } from './StatusViewer';

/** Rangée des statuts du moment : une demi-lune d'argile par boutique. */
export function StatusRail({ groups }: { groups: StatusGroup[] }) {
  const { t } = useTranslation('ateliers');
  const [open, setOpen] = useState<number | null>(null);
  if (groups.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="eyebrow" tone="muted">
        {t('statuses')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.md }}
      >
        {groups.map((g, i) => {
          const cover = g.statuses.find((s) => s.media[0]?.type === 'image')?.media[0]?.url;
          return (
            <Pressable
              key={g.merchantId}
              accessibilityRole="button"
              accessibilityLabel={t('openStatus', { shop: g.merchant?.name ?? '' })}
              onPress={() => setOpen(i)}
              style={styles.item}
            >
              <View style={styles.ring}>
                <View style={[styles.face, { backgroundColor: archTint(g.merchantId) }]}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <Text style={styles.initial}>
                      {g.merchant?.name.slice(0, 1).toUpperCase() ?? '·'}
                    </Text>
                  )}
                </View>
              </View>
              <Text variant="caption" numberOfLines={1} style={styles.name}>
                {g.merchant?.name ?? ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {open != null ? (
        <StatusViewer groups={groups} startGroup={open} onClose={() => setOpen(null)} />
      ) : null}
    </View>
  );
}

const SIZE = 68;

const styles = StyleSheet.create({
  item: { width: SIZE + 8, alignItems: 'center', gap: 6 },
  // Anneau en deux couleurs : moitié argile, moitié ocre, comme le soleil du logo.
  ring: {
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    borderWidth: 3,
    borderTopColor: colors.clay,
    borderRightColor: colors.clay,
    borderBottomColor: colors.ochre,
    borderLeftColor: colors.ochre,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    width: SIZE - 2,
    height: SIZE - 2,
    borderRadius: (SIZE - 2) / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.displayItalic, fontSize: 26, color: colors.ebony },
  name: { fontFamily: fonts.bodySemibold, maxWidth: SIZE + 8, textAlign: 'center' },
});
