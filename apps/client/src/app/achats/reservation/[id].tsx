import { useBooking, useSetBookingStatus } from '@amara/api';
import {
  BackButton,
  BookingCard,
  PaymentPanel,
  QueryState,
  RequireSession,
  useSalesErrorMessage,
} from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, Screen, space, Text } from '@amara/ui';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function BookingPage() {
  return (
    <RequireSession>
      <BookingDetail />
    </RequireSession>
  );
}

function BookingDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('catalog');
  const query = useBooking(id);
  const setStatus = useSetBookingStatus();
  const errorMessage = useSalesErrorMessage();

  return (
    <Screen>
      <BackButton />
      <QueryState query={query}>
        {(booking) =>
          !booking ? (
            <Text tone="muted">{tc('notFound')}</Text>
          ) : (
            <>
              <BookingCard booking={booking} show="shop" />
              {booking.clientMessage ? (
                <View style={{ gap: space.xs }}>
                  <Text variant="eyebrow" tone="muted">
                    {t('clientMessage')}
                  </Text>
                  <Text>{booking.clientMessage}</Text>
                </View>
              ) : null}
              {booking.merchantNote ? (
                <View style={{ gap: space.xs }}>
                  <Text variant="eyebrow" tone="muted">
                    {t('merchantNote')}
                  </Text>
                  <Text>{booking.merchantNote}</Text>
                </View>
              ) : null}
              {booking.status === 'quoted' ? (
                <Button
                  label={t('acceptQuote')}
                  loading={setStatus.isPending}
                  onPress={() => setStatus.mutate({ bookingId: booking.id, status: 'confirmed' })}
                />
              ) : null}
              {booking.status === 'awaiting_payment' ? (
                <PaymentPanel kind="booking" id={booking.id} amountXaf={booking.amountDueXaf} />
              ) : null}
              {['requested', 'quoted', 'awaiting_payment', 'confirmed'].includes(booking.status) ? (
                <Button
                  label={t('cancelBooking')}
                  variant="ghost"
                  loading={setStatus.isPending}
                  onPress={() => setStatus.mutate({ bookingId: booking.id, status: 'cancelled' })}
                />
              ) : null}
              {setStatus.error ? <Text tone="muted">{errorMessage(setStatus.error)}</Text> : null}
            </>
          )
        }
      </QueryState>
    </Screen>
  );
}
