import { useMyMerchant, type MerchantWithReview } from '@amara/api';
import { BackButton, QueryState, RequireSession } from '@amara/features';
import { Screen, Text } from '@amara/ui';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

/** Écran Pro qui a besoin de la boutique de la personne connectée. */
export function MyShopScreen({
  title,
  children,
}: {
  title: string;
  children: (merchant: MerchantWithReview) => ReactNode;
}) {
  return (
    <RequireSession badge="PRO">
      <Screen>
        <BackButton />
        <Text variant="display">{title}</Text>
        <Content>{children}</Content>
      </Screen>
    </RequireSession>
  );
}

function Content({ children }: { children: (merchant: MerchantWithReview) => ReactNode }) {
  const query = useMyMerchant();
  return (
    <QueryState query={query}>
      {(data) => (data ? children(data.merchant) : <Redirect href="/" />)}
    </QueryState>
  );
}
