import { useMerchant, useSession, useStartConversation } from '@amara/api';
import { archTint, BackButton, ProductRow, QueryState, ServiceRow, Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Arch, Button, Screen, space, Text } from '@amara/ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

export default function Shop() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation('catalog');
  const query = useMerchant(slug);
  const { t: tm } = useTranslation('messages');
  const [tab, setTab] = useState<'products' | 'services'>('products');
  const { session } = useSession();
  const startConversation = useStartConversation();
  const contact = (merchantId: string) => {
    if (!session) return router.push('/connexion');
    startConversation.mutate(merchantId, {
      onSuccess: (id) => router.push({ pathname: '/messages/[id]', params: { id } }),
    });
  };

  return (
    <Screen>
      <BackButton />
      <QueryState query={query}>
        {(data) =>
          !data ? (
            <Text tone="muted">{t('notFound')}</Text>
          ) : (
            <View style={{ gap: space.lg }}>
              <Stack.Screen options={{ title: data.merchant.name }} />
              <View style={{ alignItems: 'center', gap: space.sm }}>
                <Arch width={220} height={240} color={archTint(data.merchant.id)} />
                <Text variant="eyebrow" tone="brand">
                  {data.merchant.city}
                </Text>
                <Text variant="display" style={{ textAlign: 'center' }}>
                  {data.merchant.name}
                </Text>
                {data.merchant.bio ? (
                  <Text tone="muted" style={{ textAlign: 'center' }}>
                    {data.merchant.bio}
                  </Text>
                ) : null}
                <Button
                  label={tm('contactShop')}
                  variant="secondary"
                  loading={startConversation.isPending}
                  onPress={() => contact(data.merchant.id)}
                />
              </View>
              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { key: 'products', label: t('products') },
                  { key: 'services', label: t('services') },
                ]}
              />
              {tab === 'products' ? (
                data.products.length ? (
                  data.products.map((p) => <ProductRow key={p.id} product={p} />)
                ) : (
                  <Text tone="muted">{t('noProducts')}</Text>
                )
              ) : data.services.length ? (
                data.services.map((s) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    onPress={() =>
                      router.push({ pathname: '/reservation/[service]', params: { service: s.id } })
                    }
                  />
                ))
              ) : (
                <Text tone="muted">{t('noServices')}</Text>
              )}
            </View>
          )
        }
      </QueryState>
    </Screen>
  );
}
