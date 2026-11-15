import { useConversations } from '@amara/api';
import { formatDateTime } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, radius, space, Text } from '@amara/ui';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { QueryState } from '../catalog/QueryState';

/** Conversations du client (sans merchantId) ou de la boutique (avec). */
export function ConversationList({
  merchantId,
  hrefFor,
}: {
  merchantId?: string;
  hrefFor: (conversationId: string) => Href;
}) {
  const { t, i18n } = useTranslation('messages');
  const query = useConversations(merchantId);
  return (
    <QueryState query={query}>
      {(conversations) =>
        conversations.length === 0 ? (
          <Text tone="muted">{t('empty')}</Text>
        ) : (
          <View style={{ gap: space.sm }}>
            {conversations.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="link"
                onPress={() => router.push(hrefFor(c.id))}
                style={{
                  backgroundColor: colors.paper,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.sand,
                  padding: space.md,
                  gap: 2,
                }}
              >
                <Text variant="title" style={{ fontSize: 18 }}>
                  {merchantId ? (c.clientName ?? t('client')) : c.merchantName}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatDateTime(c.lastMessageAt, i18n.language)}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      }
    </QueryState>
  );
}
