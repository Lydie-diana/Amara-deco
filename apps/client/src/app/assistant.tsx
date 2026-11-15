import { AssistantChat, BackButton, RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Screen, Text } from '@amara/ui';

export default function Assistant() {
  const { t } = useTranslation('assistant');
  return (
    <RequireSession>
      <Screen>
        <BackButton />
        <Text variant="display">{t('title')}</Text>
        <AssistantChat />
      </Screen>
    </RequireSession>
  );
}
