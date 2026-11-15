import { AmaraDataProvider, createAmaraClient } from '@amara/api';
import { initI18n, pickLocale } from '@amara/i18n';
import { colors, useAmaraFonts } from '@amara/ui';
import { getLocales } from 'expo-localization';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Tout ce dont chaque application a besoin au démarrage : polices, traductions et accès aux données.
 * Les trois applications l'utilisent, pour que ce code n'existe qu'une fois.
 */
export function AppProviders({ children }: AppProvidersProps) {
  const fontsReady = useAmaraFonts();
  const [client] = useState(() =>
    createAmaraClient({
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    }),
  );
  // Sur le web, la page est d'abord rendue sur le serveur en français, puis passe à la langue du
  // navigateur une fois chargée : le serveur et le navigateur affichent ainsi la même première page.
  const [i18n] = useState(() =>
    initI18n(Platform.OS === 'web' ? 'fr' : pickLocale(getLocales().map((l) => l.languageCode))),
  );
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const preferred = pickLocale(getLocales().map((l) => l.languageCode));
    if (preferred !== i18n.language) void i18n.changeLanguage(preferred);
  }, [i18n]);

  if (!fontsReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.linen,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }
  return <AmaraDataProvider client={client}>{children}</AmaraDataProvider>;
}
