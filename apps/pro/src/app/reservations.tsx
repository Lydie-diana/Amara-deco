import { useBookings, useSetBookingStatus, type Booking } from '@amara/api';
import { BookingCard, QueryState, useSalesErrorMessage } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { View } from 'react-native';

import { MyShopScreen } from '../components/MyShopScreen';

export default function Bookings() {
  const { t } = useTranslation('sales');
  return (
    <MyShopScreen title={t('bookings')}>
      {(merchant) => <BookingList merchantId={merchant.id} />}
    </MyShopScreen>
  );
}

function BookingList({ merchantId }: { merchantId: string }) {
  const { t } = useTranslation('sales');
  const query = useBookings({ merchantId });
  return (
    <QueryState query={query}>
      {(bookings) =>
        bookings.length === 0 ? (
          <Text tone="muted">{t('noBookings')}</Text>
        ) : (
          <View style={{ gap: space.md }}>
            {bookings.map((b) => (
              <MerchantBooking key={b.id} booking={b} />
            ))}
          </View>
        )
      }
    </QueryState>
  );
}

function MerchantBooking({ booking }: { booking: Booking }) {
  const { t } = useTranslation('sales');
  const setStatus = useSetBookingStatus();
  const errorMessage = useSalesErrorMessage();
  const open = ['requested', 'quoted'].includes(booking.status);
  return (
    <BookingCard booking={booking} show="client">
      {booking.clientMessage ? <Text tone="muted">« {booking.clientMessage} »</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {open && booking.mode === 'quote' ? (
          <Button
            label={t('sendQuote')}
            onPress={() => router.push({ pathname: '/devis/[id]', params: { id: booking.id } })}
          />
        ) : null}
        {booking.status === 'confirmed' ? (
          <Button
            label={t('markCompleted')}
            loading={setStatus.isPending}
            onPress={() => setStatus.mutate({ bookingId: booking.id, status: 'completed' })}
          />
        ) : null}
        {open ? (
          <Button
            label={t('decline')}
            variant="ghost"
            onPress={() => setStatus.mutate({ bookingId: booking.id, status: 'declined' })}
          />
        ) : null}
        {['awaiting_payment', 'confirmed'].includes(booking.status) ? (
          <Button
            label={t('cancel')}
            variant="ghost"
            onPress={() => setStatus.mutate({ bookingId: booking.id, status: 'cancelled' })}
          />
        ) : null}
      </View>
      {setStatus.error ? <Text tone="muted">{errorMessage(setStatus.error)}</Text> : null}
    </BookingCard>
  );
}
