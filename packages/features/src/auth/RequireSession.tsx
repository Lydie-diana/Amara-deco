import { useSession } from '@amara/api';
import { colors } from '@amara/ui';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PhoneSignInScreen } from './PhoneSignInScreen';

export interface RequireSessionProps {
  badge?: string;
  children: ReactNode;
}

/** Affiche la connexion tant que personne n'est connecté (Amara Pro et Admin). */
export function RequireSession({ badge, children }: RequireSessionProps) {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.linen,
        }}
      >
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }
  if (!session) return <PhoneSignInScreen badge={badge} />;
  return <>{children}</>;
}
