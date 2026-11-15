import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, touchTarget } from '@amara/ui';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

export function BackButton() {
  const { t } = useTranslation('common');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [
        {
          minHeight: touchTarget,
          paddingHorizontal: 16,
          borderRadius: radius.pill,
          backgroundColor: colors.paper,
          justifyContent: 'center',
          alignSelf: 'flex-start',
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ebony }}>
        ← {t('back')}
      </Text>
    </Pressable>
  );
}
