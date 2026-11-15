import { ChatThread } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { useLocalSearchParams } from 'expo-router';

import { MyShopScreen } from '../../components/MyShopScreen';

export default function Conversation() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('messages');
  return <MyShopScreen title={t('title')}>{() => <ChatThread conversationId={id} />}</MyShopScreen>;
}
