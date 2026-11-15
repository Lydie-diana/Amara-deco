import { useAtelierFeed, useStatuses } from '@amara/api';
import { useTranslation } from '@amara/i18n';
import { Button, space, Text } from '@amara/ui';
import { ActivityIndicator, View } from 'react-native';

import { QueryState } from '../catalog/QueryState';
import { PostCard } from './PostCard';
import { StatusRail } from './StatusRail';

/** Fil des Ateliers : statuts du moment, puis publications, page par page. */
export function AtelierFeed() {
  const { t } = useTranslation('ateliers');
  const statuses = useStatuses();
  const feed = useAtelierFeed();
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <View style={{ gap: space.lg }}>
      {statuses.data ? <StatusRail groups={statuses.data} /> : null}
      <QueryState query={feed}>
        {() =>
          posts.length === 0 ? (
            <Text tone="muted">{t('empty')}</Text>
          ) : (
            <View style={{ gap: space.lg }}>
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {feed.hasNextPage ? (
                <Button
                  label={t('more')}
                  variant="secondary"
                  loading={feed.isFetchingNextPage}
                  onPress={() => void feed.fetchNextPage()}
                />
              ) : null}
            </View>
          )
        }
      </QueryState>
      {feed.isRefetching && !feed.isFetchingNextPage ? <ActivityIndicator /> : null}
    </View>
  );
}
