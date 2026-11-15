import { useBookings, useOrders, useSetBookingStatus, useSetOrderStatus } from '@amara/api';
import { formatXaf } from '@amara/core';
import { BookingCard, OrderCard, QueryState } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, space, Text } from '@amara/ui';
import { StyleSheet, View } from 'react-native';

/** Toutes les commandes de la plateforme, avec la commission d'Amara. */
export function AllOrders() {
  const { t } = useTranslation('sales');
  const query = useOrders({ all: true });
  const setStatus = useSetOrderStatus();
  return (
    <QueryState query={query}>
      {(orders) =>
        orders.length === 0 ? (
          <Text tone="muted">{t('noOrders')}</Text>
        ) : (
          <View style={styles.grid}>
            {orders.map((o) => (
              <View key={o.id} style={styles.cell}>
                <OrderCard order={o} show="shop">
                  <Text variant="caption" tone="muted">
                    {t('commission')} : {formatXaf(o.commissionXaf)}
                  </Text>
                  {o.status !== 'delivered' && o.status !== 'cancelled' ? (
                    <Button
                      label={t('cancelOrder')}
                      variant="ghost"
                      onPress={() => setStatus.mutate({ orderId: o.id, status: 'cancelled' })}
                    />
                  ) : null}
                </OrderCard>
              </View>
            ))}
          </View>
        )
      }
    </QueryState>
  );
}

/** Toutes les réservations de la plateforme. */
export function AllBookings() {
  const { t } = useTranslation('sales');
  const query = useBookings({ all: true });
  const setStatus = useSetBookingStatus();
  return (
    <QueryState query={query}>
      {(bookings) =>
        bookings.length === 0 ? (
          <Text tone="muted">{t('noBookings')}</Text>
        ) : (
          <View style={styles.grid}>
            {bookings.map((b) => (
              <View key={b.id} style={styles.cell}>
                <BookingCard booking={b} show="shop">
                  {['requested', 'quoted', 'awaiting_payment', 'confirmed'].includes(b.status) ? (
                    <Button
                      label={t('cancelBooking')}
                      variant="ghost"
                      onPress={() => setStatus.mutate({ bookingId: b.id, status: 'cancelled' })}
                    />
                  ) : null}
                </BookingCard>
              </View>
            ))}
          </View>
        )
      }
    </QueryState>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { flexGrow: 1, flexBasis: 300, maxWidth: 520 },
});
