import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, touchTarget } from '@amara/ui';
import { Pressable, Text, View } from 'react-native';

export function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation('cart');
  const button = (label: string, a11y: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={{
        width: touchTarget,
        height: touchTarget,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.linen,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ebony }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      accessibilityLabel={t('quantity')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      {button('−', t('decrease'), value - 1, false)}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, minWidth: 24, textAlign: 'center' }}>
        {value}
      </Text>
      {button('+', t('increase'), value + 1, value >= max)}
    </View>
  );
}
