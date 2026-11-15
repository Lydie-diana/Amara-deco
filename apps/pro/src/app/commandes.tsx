import { useOrders, useSetOrderStatus, type Order, type OrderStatus } from '@amara/api';
import { OrderCard, QueryState, useSalesErrorMessage } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, space, Text } from '@amara/ui';
import { View } from 'react-native';

import { MyShopScreen } from '../components/MyShopScreen';

export default function Orders() {
  const { t } = useTranslation('sales');
  return (
    <MyShopScreen title={t('orders')}>
      {(merchant) => <OrderList merchantId={merchant.id} />}
    </MyShopScreen>
  );
}

/** Prochaine étape proposée à l'artisan selon le statut. */
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  paid: { status: 'accepted', label: 'accept' },
  accepted: { status: 'preparing', label: 'prepare' },
  preparing: { status: 'delivered', label: 'markDelivered' },
};

function OrderList({ merchantId }: { merchantId: string }) {
  const { t } = useTranslation('sales');
  const query = useOrders({ merchantId });
  return (
    <QueryState query={query}>
      {(orders) =>
        orders.length === 0 ? (
          <Text tone="muted">{t('noOrders')}</Text>
        ) : (
          <View style={{ gap: space.md }}>
            {orders.map((o) => (
              <MerchantOrder key={o.id} order={o} />
            ))}
          </View>
        )
      }
    </QueryState>
  );
}

function MerchantOrder({ order }: { order: Order }) {
  const { t } = useTranslation('sales');
  const setStatus = useSetOrderStatus();
  const errorMessage = useSalesErrorMessage();
  const next = NEXT[order.status];
  const canCancel = order.status !== 'delivered' && order.status !== 'cancelled';
  return (
    <OrderCard order={order} show="delivery">
      <Text variant="caption" tone="muted">
        {order.contactPhone}
        {order.note ? ` · ${order.note}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {next ? (
          <Button
            label={t(next.label)}
            loading={setStatus.isPending}
            onPress={() => setStatus.mutate({ orderId: order.id, status: next.status })}
          />
        ) : null}
        {canCancel ? (
          <Button
            label={t('cancel')}
            variant="ghost"
            onPress={() => setStatus.mutate({ orderId: order.id, status: 'cancelled' })}
          />
        ) : null}
      </View>
      {setStatus.error ? <Text tone="muted">{errorMessage(setStatus.error)}</Text> : null}
    </OrderCard>
  );
}
