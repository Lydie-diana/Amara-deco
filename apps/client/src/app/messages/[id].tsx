import { BackButton, ChatThread, RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Screen, Text } from '@amara/ui';
import { useLocalSearchParams } from 'expo-router';

export default function Conversation() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('messages');
  return (
    <RequireSession>
      <Screen>
        <BackButton />
        <Text variant="title">{t('title')}</Text>
        <ChatThread conversationId={id} />
      </Screen>
    </RequireSession>
  );
}
