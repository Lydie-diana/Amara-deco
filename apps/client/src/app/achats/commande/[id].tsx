import { useOrder, useSetOrderStatus } from '@amara/api';
import {
  BackButton,
  OrderCard,
  PaymentPanel,
  QueryState,
  RequireSession,
  useSalesErrorMessage,
} from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, Screen, Text } from '@amara/ui';
import { useLocalSearchParams } from 'expo-router';

export default function OrderPage() {
  return (
    <RequireSession>
      <OrderDetail />
    </RequireSession>
  );
}

function OrderDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('catalog');
  const query = useOrder(id);
  const setStatus = useSetOrderStatus();
  const errorMessage = useSalesErrorMessage();

  return (
    <Screen>
      <BackButton />
      <QueryState query={query}>
        {(order) =>
          !order ? (
            <Text tone="muted">{tc('notFound')}</Text>
          ) : (
            <>
              <OrderCard order={order} show="shop" />
              <Text tone="muted">
                {t('deliveryTo', { place: `${order.deliveryAddress}, ${order.deliveryCity}` })}
              </Text>
              {order.status === 'awaiting_payment' ? (
                <>
                  <PaymentPanel kind="order" id={order.id} amountXaf={order.subtotalXaf} />
                  <Button
                    label={t('cancelOrder')}
                    variant="ghost"
                    loading={setStatus.isPending}
                    onPress={() => setStatus.mutate({ orderId: order.id, status: 'cancelled' })}
                  />
                </>
              ) : null}
              {order.status === 'paid' ? <Text>{t('paymentSucceeded')}</Text> : null}
              {setStatus.error ? <Text tone="muted">{errorMessage(setStatus.error)}</Text> : null}
            </>
          )
        }
      </QueryState>
    </Screen>
  );
}
