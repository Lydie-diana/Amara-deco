import { useDeletePost, useMyPosts, type AtelierPost } from '@amara/api';
import { formatTime } from '@amara/core';
import { PostCard, QueryState, ReviewPill } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, space, Text } from '@amara/ui';
import { View } from 'react-native';

import { MyShopScreen } from '../components/MyShopScreen';
import { PostComposer } from '../components/PostComposer';

export default function Ateliers() {
  const { t } = useTranslation('ateliers');
  return (
    <MyShopScreen title={t('title')}>
      {(merchant) =>
        merchant.reviewStatus !== 'approved' ? (
          <Text tone="muted">{t('shopNotApproved')}</Text>
        ) : (
          <View style={{ gap: space.lg }}>
            <PostComposer merchantId={merchant.id} />
            <MyPosts merchantId={merchant.id} />
          </View>
        )
      }
    </MyShopScreen>
  );
}

function MyPosts({ merchantId }: { merchantId: string }) {
  const { t } = useTranslation('ateliers');
  const query = useMyPosts(merchantId);
  return (
    <View style={{ gap: space.md }}>
      <Text variant="title">{t('myPosts')}</Text>
      <QueryState query={query}>
        {(posts) =>
          posts.length === 0 ? (
            <Text tone="muted">{t('noPosts')}</Text>
          ) : (
            <View style={{ gap: space.lg }}>
              {posts.map((p) => (
                <MyPost key={p.id} post={p} />
              ))}
            </View>
          )
        }
      </QueryState>
    </View>
  );
}

function MyPost({ post }: { post: AtelierPost }) {
  const { t, i18n } = useTranslation('ateliers');
  const remove = useDeletePost();
  const expired = post.expiresAt != null && new Date(post.expiresAt) <= new Date();
  return (
    <PostCard post={post} linkToShop={false}>
      <View style={{ flex: 1, gap: space.xs }}>
        <ReviewPill status={post.reviewStatus} />
        {post.reviewStatus === 'rejected' && post.reviewNote ? (
          <Text variant="caption" style={{ color: colors.clay }}>
            {t('rejectedNote', { note: post.reviewNote })}
          </Text>
        ) : null}
        {post.expiresAt ? (
          <Text variant="caption" tone="muted">
            {expired
              ? t('expired')
              : t('statusEnds', { time: formatTime(post.expiresAt, i18n.language) })}
          </Text>
        ) : null}
      </View>
      <Button
        label={t('delete')}
        variant="ghost"
        loading={remove.isPending}
        onPress={() => remove.mutate(post)}
      />
    </PostCard>
  );
}
