import { AmaraDataProvider, createAmaraClient } from '@amara/api';
import { I18nextProvider, initI18n, pickLocale } from '@amara/i18n';
import { colors, useAmaraFonts } from '@amara/ui';
import { getLocales } from 'expo-localization';
import { startTransition, useEffect, useState, type ReactNode } from 'react';
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
  // navigateur une fois chargée. La langue passe par l'état React (et non en modifiant l'instance
  // partagée) : les parties de la page encore en cours d'hydratation gardent ainsi le français
  // du serveur, sans écart entre le HTML reçu et le premier rendu.
  const [i18n, setI18n] = useState(() =>
    initI18n(Platform.OS === 'web' ? 'fr' : pickLocale(getLocales().map((l) => l.languageCode))),
  );
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const preferred = pickLocale(getLocales().map((l) => l.languageCode));
    if (preferred === i18n.language) return;
    startTransition(() => setI18n(i18n.cloneInstance({ lng: preferred, initAsync: false })));
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
  return (
    <I18nextProvider i18n={i18n}>
      <AmaraDataProvider client={client}>{children}</AmaraDataProvider>
    </I18nextProvider>
  );
}
