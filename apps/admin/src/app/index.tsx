import { RequireSession } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { colors, Logo, Screen, space, Text } from '@amara/ui';
import { StyleSheet, View } from 'react-native';

export default function AdminHome() {
  const { t } = useTranslation('admin');
  return (
    <RequireSession badge="ADMIN">
      <Screen maxWidth={1100}>
        <View style={styles.banner}>
          <Logo badge="ADMIN" inverse />
        </View>
        <Text variant="display">{t('title')}</Text>
        <Text tone="muted">{t('comingSoon')}</Text>
      </Screen>
    </RequireSession>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.ebony,
    borderRadius: 24,
    padding: space.lg,
    alignSelf: 'flex-start',
  },
});
