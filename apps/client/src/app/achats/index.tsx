import { useBookings, useOrders } from '@amara/api';
import {
  BackButton,
  BookingCard,
  OrderCard,
  QueryState,
  RequireSession,
  Tabs,
} from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Screen, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

export default function Purchases() {
  return (
    <RequireSession>
      <PurchaseList />
    </RequireSession>
  );
}

function PurchaseList() {
  const { t } = useTranslation('sales');
  const [tab, setTab] = useState<'orders' | 'bookings'>('orders');
  const orders = useOrders({ buyer: true });
  const bookings = useBookings({ buyer: true });

  return (
    <Screen>
      <BackButton />
      <Text variant="display">{t('myPurchases')}</Text>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'orders', label: t('orders') },
          { key: 'bookings', label: t('bookings') },
        ]}
      />
      {tab === 'orders' ? (
        <QueryState query={orders}>
          {(list) =>
            list.length === 0 ? (
              <Text tone="muted">{t('noOrders')}</Text>
            ) : (
              <View style={{ gap: space.md }}>
                {list.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    show="shop"
                    onPress={() =>
                      router.push({ pathname: '/achats/commande/[id]', params: { id: o.id } })
                    }
                  />
                ))}
              </View>
            )
          }
        </QueryState>
      ) : (
        <QueryState query={bookings}>
          {(list) =>
            list.length === 0 ? (
              <Text tone="muted">{t('noBookings')}</Text>
            ) : (
              <View style={{ gap: space.md }}>
                {list.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    show="shop"
                    onPress={() =>
                      router.push({ pathname: '/achats/reservation/[id]', params: { id: b.id } })
                    }
                  />
                ))}
              </View>
            )
          }
        </QueryState>
      )}
    </Screen>
  );
}
