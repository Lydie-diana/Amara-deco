import type { StatusGroup } from '@amara/api';
import { formatTime } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, space, Text } from '@amara/ui';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaView } from './MediaView';

const IMAGE_MS = 5000;
const MAX_VIDEO_MS = 30000;

/**
 * Lecture plein écran des statuts : touche à droite pour avancer, à gauche pour revenir.
 * Passe tout seul au suivant, puis à la boutique suivante.
 */
export function StatusViewer({
  groups,
  startGroup,
  onClose,
}: {
  groups: StatusGroup[];
  startGroup: number;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('ateliers');
  const [g, setG] = useState(startGroup);
  const [i, setI] = useState(0);
  const group = groups[g];
  const status = group?.statuses[i];
  const media = status?.media[0];

  const next = () => {
    if (!group) return onClose();
    if (i + 1 < group.statuses.length) return setI(i + 1);
    if (g + 1 < groups.length) {
      setG(g + 1);
      return setI(0);
    }
    onClose();
  };
  const previous = () => {
    if (i > 0) return setI(i - 1);
    if (g > 0) {
      setG(g - 1);
      setI(groups[g - 1]!.statuses.length - 1);
    }
  };

  const duration =
    media?.type === 'video' ? Math.min(media.durationMs ?? MAX_VIDEO_MS, MAX_VIDEO_MS) : IMAGE_MS;
  // La barre du statut en cours se remplit, puis on passe au suivant.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    run.start(({ finished }) => finished && next());
    return () => run.stop();
  }, [g, i, duration]);

  if (!group || !status) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.screen}>
        <View style={styles.bars}>
          {group.statuses.map((s, k) => (
            <View key={s.id} style={styles.bar}>
              {k === i ? (
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              ) : (
                <View style={[styles.fill, { width: k < i ? '100%' : '0%' }]} />
              )}
            </View>
          ))}
        </View>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text tone="inverse" style={{ fontFamily: fonts.bodyBold }}>
              {group.merchant?.name ?? ''}
            </Text>
            {status.publishedAt ? (
              <Text variant="caption" style={{ color: colors.sand }}>
                {formatTime(status.publishedAt, i18n.language)}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={onClose}
            style={styles.close}
          >
            <Text tone="inverse" style={{ fontSize: 22 }}>
              ×
            </Text>
          </Pressable>
        </View>
        <View style={styles.stage}>
          {media ? (
            <MediaView key={media.id} media={media} fit="contain" autoPlay style={styles.media} />
          ) : null}
          <View style={styles.zones}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('previous')}
              onPress={previous}
              style={{ flex: 1 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('next')}
              onPress={next}
              style={{ flex: 2 }}
            />
          </View>
        </View>
        {status.caption ? (
          <Text tone="inverse" style={styles.caption}>
            {status.caption}
          </Text>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ebony },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: space.md, paddingTop: space.sm },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,252,247,0.25)',
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.paper },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1 },
  media: { flex: 1, width: '100%', backgroundColor: colors.ebony },
  zones: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' },
  caption: { padding: space.lg, textAlign: 'center' },
});
