import { BackButton, ConversationList, RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Screen, Text } from '@amara/ui';

export default function Messages() {
  const { t } = useTranslation('messages');
  return (
    <RequireSession>
      <Screen>
        <BackButton />
        <Text variant="display">{t('title')}</Text>
        <ConversationList hrefFor={(id) => ({ pathname: '/messages/[id]', params: { id } })} />
      </Screen>
    </RequireSession>
  );
}
