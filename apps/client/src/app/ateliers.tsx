import { AtelierFeed, BackButton } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Screen, Text } from '@amara/ui';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function Ateliers() {
  const { t } = useTranslation('ateliers');
  return (
    <Screen>
      <Stack.Screen options={{ title: t('title') }} />
      <BackButton />
      <View style={{ gap: 8 }}>
        <Text variant="display">{t('title')}</Text>
        <Text tone="muted">{t('subtitle')}</Text>
      </View>
      <AtelierFeed />
    </Screen>
  );
}
