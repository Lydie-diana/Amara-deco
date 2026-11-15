import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, touchTarget } from '@amara/ui';
import { Pressable, StyleSheet, Text } from 'react-native';

/** Bascule entre le français et l'anglais. */
export function LanguageToggle() {
  const { t, i18n } = useTranslation('common');
  const next = i18n.language === 'fr' ? 'en' : 'fr';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void i18n.changeLanguage(next)}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.label}>{t('languageToggle')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: touchTarget,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.ebony },
});
