import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from './tokens';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Largeur maximale du contenu sur grand écran (site web, tablette). */
  maxWidth?: number;
}

/** Fond lin, marges et zones sûres communes à tous les écrans. */
export function Screen({ children, scroll = true, maxWidth = 560 }: ScreenProps) {
  const content = <View style={[styles.content, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.linen },
  scroll: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.lg,
  },
});
