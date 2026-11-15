import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { colors, fonts, radius, space, touchTarget } from './tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

/** Champ de saisie avec libellé et message d'erreur. En React 19, `ref` passe comme une prop. */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.stone}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { fontFamily: fonts.bodySemibold, color: colors.ebony },
  input: {
    minHeight: touchTarget + 4,
    paddingHorizontal: space.md + 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.sand,
    backgroundColor: colors.paper,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ebony,
  },
  inputError: { borderColor: colors.clay },
  error: { color: colors.clay },
});
