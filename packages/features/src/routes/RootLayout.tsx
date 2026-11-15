import { colors } from '@amara/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '../app/AppProviders';

/** Mise en page racine commune aux trois applications. */
export function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.linen } }}
      />
    </AppProviders>
  );
}
