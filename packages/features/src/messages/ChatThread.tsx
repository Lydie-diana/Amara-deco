import { useMarkConversationRead, useMessages, useSendMessage, useSession } from '@amara/api';
import { formatTime } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { Button, colors, fonts, radius, space, Text, touchTarget } from '@amara/ui';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { QueryState } from '../catalog/QueryState';

/** Fil de messages d'une conversation et zone de saisie. */
export function ChatThread({ conversationId }: { conversationId: string }) {
  const { t, i18n } = useTranslation('messages');
  const { session } = useSession();
  const me = session?.user.id;
  const query = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const markRead = useMarkConversationRead();
  const [draft, setDraft] = useState('');
  const count = query.data?.length ?? 0;

  // Marquer comme lu à chaque nouveau message reçu.
  const { mutate: markAsRead } = markRead;
  useEffect(() => {
    if (count > 0) markAsRead(conversationId);
  }, [conversationId, count, markAsRead]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    send.mutate(body, { onSuccess: () => setDraft('') });
  };

  return (
    <View style={{ gap: space.md }}>
      <QueryState query={query}>
        {(messages) =>
          messages.length === 0 ? null : (
            <View style={{ gap: space.sm }}>
              {messages.map((m) => {
                const mine = m.senderId === me;
                return (
                  <View
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      backgroundColor: mine ? colors.ebony : colors.paper,
                      borderWidth: mine ? 0 : 1,
                      borderColor: colors.sand,
                      borderRadius: 20,
                      borderBottomRightRadius: mine ? 4 : 20,
                      borderBottomLeftRadius: mine ? 20 : 4,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: mine ? colors.paper : colors.ebony }}>{m.body}</Text>
                    <Text
                      variant="caption"
                      style={{ color: mine ? colors.sand : colors.stone, fontSize: 11 }}
                    >
                      {formatTime(m.createdAt, i18n.language)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )
        }
      </QueryState>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <TextInput
          accessibilityLabel={t('placeholder')}
          placeholder={t('placeholder')}
          placeholderTextColor={colors.stone}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          multiline
          style={{
            flex: 1,
            minHeight: touchTarget + 2,
            maxHeight: 140,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.sand,
            backgroundColor: colors.paper,
            paddingHorizontal: space.md,
            paddingVertical: 12,
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.ebony,
          }}
        />
        <Button label={t('send')} onPress={submit} loading={send.isPending} />
      </View>
    </View>
  );
}
