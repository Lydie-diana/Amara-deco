import { LanguageToggle } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Arch, Button, colors, fonts, Logo, Screen, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const CATEGORIES = [
  { key: 'sculpture', color: colors.clay },
  { key: 'furniture', color: colors.olive },
  { key: 'textile', color: colors.ochre },
  { key: 'lighting', color: colors.sand },
  { key: 'services', color: colors.paper },
] as const;

export default function Home() {
  const { t } = useTranslation('home');

  return (
    <Screen>
      <View style={styles.header}>
        <Logo />
        <LanguageToggle />
      </View>

      <View style={styles.hero}>
        <Text variant="display">
          {t('title')}{' '}
          <Text variant="display" italic tone="brand" inline>
            {t('titleAccent')}
          </Text>
        </Text>
        <Text tone="muted">{t('subtitle')}</Text>
      </View>

      <View style={{ gap: space.md }}>
        <Text variant="eyebrow" tone="muted">
          {t('categories')}
        </Text>
        <View style={styles.categories}>
          {CATEGORIES.map(({ key, color }) => (
            <View key={key} style={styles.category}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: color },
                  color === colors.paper && { borderWidth: 1.5, borderColor: colors.olive },
                ]}
              />
              <Text variant="caption" style={{ fontFamily: fonts.bodySemibold }}>
                {t(key)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.showcase}>
        <Arch width={150} height={190} color="#C9B79C" />
        <Arch width={150} height={190} color="#8E9A78" />
      </View>

      <Button label={t('signIn')} onPress={() => router.push('/connexion')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { gap: space.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 4 },
  category: { alignItems: 'center', gap: space.sm, width: 58 },
  dot: { width: 52, height: 52, borderRadius: 26 },
  showcase: { flexDirection: 'row', gap: space.md, justifyContent: 'center' },
});
