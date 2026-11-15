import type { AtelierPost } from '@amara/api';
import { formatDateTime } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { archTint } from '../catalog/labels';
import { MediaView } from './MediaView';

export interface PostCardProps {
  post: AtelierPost;
  /** Lien vers la boutique dans l'en-tête (désactivé sur la page boutique elle-même). */
  linkToShop?: boolean;
  /** Actions propres à l'écran (validation, suppression…). */
  children?: ReactNode;
}

/** Une publication d'Atelier : en-tête de la boutique, photos et vidéos à faire défiler, légende. */
export function PostCard({ post, linkToShop = true, children }: PostCardProps) {
  const { t, i18n } = useTranslation('ateliers');
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const date = post.publishedAt ?? post.createdAt;
  const shop = post.merchant;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={linkToShop && shop ? 'link' : undefined}
        disabled={!linkToShop || !shop}
        onPress={() =>
          shop && router.push({ pathname: '/boutique/[slug]', params: { slug: shop.slug } })
        }
        style={styles.header}
      >
        <View style={[styles.avatar, { backgroundColor: archTint(post.merchantId) }]}>
          <Text style={styles.initial}>{shop?.name.slice(0, 1).toUpperCase() ?? '·'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bodyBold }}>{shop?.name ?? ''}</Text>
          <Text variant="caption" tone="muted">
            {[shop?.city, formatDateTime(date, i18n.language)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {post.kind === 'status' ? (
          <Text variant="eyebrow" tone="brand">
            {t('status')}
          </Text>
        ) : null}
      </Pressable>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.frame}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            scrollEventThrottle={64}
            onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {post.media.map((m) => (
              <MediaView key={m.id} media={m} style={{ width, height: width * 1.25 }} />
            ))}
          </ScrollView>
        ) : null}
        {post.media.length > 1 ? (
          <View
            style={styles.dots}
            accessibilityLabel={t('mediaCount', { index: index + 1, count: post.media.length })}
          >
            {post.media.map((m, i) => (
              <View key={m.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      {children ? (
        <View style={[styles.actions, !post.caption && { paddingTop: space.md }]}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sandLine,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 4, padding: space.md },
  // Petite arche : l'avatar reprend la forme du logo.
  avatar: {
    width: 40,
    height: 46,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.displayItalic, fontSize: 20, color: colors.ebony },
  frame: { width: '100%', aspectRatio: 0.8, backgroundColor: colors.sand },
  dots: {
    position: 'absolute',
    bottom: space.sm + 4,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,252,247,0.55)' },
  dotActive: { backgroundColor: colors.paper, width: 16 },
  caption: { padding: space.md },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
});
