import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fonts } from './tokens';

type Variant = 'display' | 'title' | 'body' | 'caption' | 'eyebrow';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  italic?: boolean;
  tone?: 'default' | 'muted' | 'brand' | 'inverse';
  /** Texte placé à l'intérieur d'un autre texte : il ne redevient pas un titre à part. */
  inline?: boolean;
}

const toneColor = {
  default: colors.ebony,
  muted: colors.stone,
  brand: colors.olive,
  inverse: colors.paper,
} as const;

export function Text({
  variant = 'body',
  italic = false,
  tone = 'default',
  inline = false,
  style,
  ...rest
}: TextProps) {
  const isHeading = variant === 'display' || variant === 'title';
  return (
    <RNText
      accessibilityRole={isHeading && !inline ? 'header' : undefined}
      style={[
        styles[variant],
        italic && isHeading && { fontFamily: fonts.displayItalic },
        { color: toneColor[tone] },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});
