import { ConversationList } from '@amara/features';
import { useTranslation } from '@amara/i18n';

import { MyShopScreen } from '../../components/MyShopScreen';

export default function Messages() {
  const { t } = useTranslation('messages');
  return (
    <MyShopScreen title={t('title')}>
      {(merchant) => (
        <ConversationList
          merchantId={merchant.id}
          hrefFor={(id) => ({ pathname: '/messages/[id]', params: { id } })}
        />
      )}
    </MyShopScreen>
  );
}
