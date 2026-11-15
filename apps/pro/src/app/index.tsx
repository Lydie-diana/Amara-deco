import { RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { colors, Logo, Screen, space, Text } from '@amara/ui';
import { StyleSheet, View } from 'react-native';

export default function Dashboard() {
  const { t } = useTranslation('pro');
  return (
    <RequireSession badge="PRO">
      <Screen>
        <View style={styles.banner}>
          <Logo badge="PRO" inverse />
          <Text variant="title" tone="inverse">
            {t('welcome')}
          </Text>
        </View>
        <Text tone="muted">{t('comingSoon')}</Text>
      </Screen>
    </RequireSession>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.olive,
    borderRadius: 32,
    padding: space.lg,
    gap: space.md,
  },
});
