import { useTranslation } from '@amara/i18n';
import { Arch, Button, colors, Screen, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

/** Page affichée pour une adresse inconnue. */
export function NotFoundScreen() {
  const { t } = useTranslation('common');
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxl }}>
        <Arch width={120} height={150} color={colors.sand} />
        <Text variant="title">404</Text>
        <Button label={t('back')} variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
