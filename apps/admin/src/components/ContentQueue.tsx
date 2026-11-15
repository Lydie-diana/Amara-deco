import { usePendingPosts, useReviewPost, type AtelierPost } from '@amara/api';
import { formatDateTime } from '@amara/core';
import { PostCard, QueryState } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** Contenus des Ateliers en attente : la super admin valide ou refuse avec un motif. */
export function ContentQueue() {
  const { t } = useTranslation('ateliers');
  const pending = usePendingPosts();
  return (
    <View style={{ gap: space.md }}>
      <Text variant="display">{t('queueTitle')}</Text>
      <QueryState query={pending}>
        {(posts) =>
          posts.length === 0 ? (
            <Text tone="muted">{t('queueEmpty')}</Text>
          ) : (
            <View style={styles.grid}>
              {posts.map((p) => (
                <View key={p.id} style={styles.cell}>
                  <PendingPost post={p} />
                </View>
              ))}
            </View>
          )
        }
      </QueryState>
    </View>
  );
}

function PendingPost({ post }: { post: AtelierPost }) {
  const { t, i18n } = useTranslation('ateliers');
  const review = useReviewPost();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <PostCard post={post}>
      <View style={{ width: '100%', gap: space.sm }}>
        <Text variant="caption" tone="muted">
          {post.kind === 'status' ? `${t('kindStatus')} · ` : ''}
          {t('sentOn', { date: formatDateTime(post.createdAt, i18n.language) })}
        </Text>
        {rejecting ? (
          <>
            <TextField label={t('rejectNote')} value={note} onChangeText={setNote} />
            <Button
              label={t('reject')}
              loading={review.isPending}
              onPress={() =>
                review.mutate({
                  postId: post.id,
                  decision: 'rejected',
                  note: note.trim() || undefined,
                })
              }
            />
          </>
        ) : (
          <View style={styles.actions}>
            <Button
              label={t('approve')}
              loading={review.isPending}
              onPress={() => review.mutate({ postId: post.id, decision: 'approved' })}
            />
            <Button label={t('reject')} variant="secondary" onPress={() => setRejecting(true)} />
          </View>
        )}
        {review.isError ? (
          <Text variant="caption" style={{ color: colors.clay }}>
            {String(review.error.message)}
          </Text>
        ) : null}
      </View>
    </PostCard>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { flexGrow: 1, flexBasis: 320, maxWidth: 420 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
