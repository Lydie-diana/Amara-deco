import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './tokens';

export interface LogoProps {
  size?: number;
  /** Mention affichée à côté du nom : « PRO » ou « ADMIN ». */
  badge?: string;
  inverse?: boolean;
}

/** Symbole (une arche et un soleil d'argile) suivi du nom « amara ». */
export function Logo({ size = 26, badge, inverse = false }: LogoProps) {
  const ink = inverse ? colors.paper : colors.olive;
  const markWidth = size * 0.8;
  const stroke = Math.max(2, size * 0.09);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={badge ? `Amara ${badge}` : 'Amara'}
    >
      <View
        style={{
          width: markWidth,
          height: size,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: ink,
          borderTopLeftRadius: markWidth / 2,
          borderTopRightRadius: markWidth / 2,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: size * 0.18,
        }}
      >
        <View
          style={{
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size,
            backgroundColor: badge ? colors.ochre : colors.clay,
          }}
        />
      </View>
      <Text style={[styles.word, { fontSize: size, color: inverse ? colors.paper : colors.ebony }]}>
        amara
      </Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  word: { fontFamily: fonts.displayItalic, lineHeight: undefined },
  badge: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.ochre,
    marginBottom: 4,
  },
});
