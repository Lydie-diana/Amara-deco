import { useAmaraClient } from '@amara/api';
import { useTranslation } from '@amara/i18n';
import { Button, colors, space, Text } from '@amara/ui';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

export interface QueryStateProps<T> {
  query: { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
}

/** Affiche le chargement, l'erreur (avec « Réessayer ») ou le contenu d'une requête. */
export function QueryState<T>({ query, children }: QueryStateProps<T>) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const client = useAmaraClient();

  if (!client) {
    return <Text tone="muted">{tc('configMissing')}</Text>;
  }
  if (query.isError) {
    return (
      <View style={{ gap: space.md, alignItems: 'flex-start' }}>
        <Text tone="muted">{t('error')}</Text>
        <Button label={t('retry')} variant="secondary" onPress={() => void query.refetch()} />
      </View>
    );
  }
  if (query.isPending || query.data === undefined) {
    return <ActivityIndicator color={colors.clay} style={{ paddingVertical: space.xl }} />;
  }
  return <>{children(query.data)}</>;
}
