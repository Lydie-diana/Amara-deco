import { useBooking, useQuoteBooking } from '@amara/api';
import { cameroonInstant, parseWholeNumber } from '@amara/core';
import { BookingCard, QueryState, useSalesErrorMessage } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, Text, TextField } from '@amara/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MyShopScreen } from '../../components/MyShopScreen';

export default function QuotePage() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('sales');
  return <MyShopScreen title={t('sendQuote')}>{() => <QuoteForm bookingId={id} />}</MyShopScreen>;
}

function QuoteForm({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('catalog');
  const { t: tm } = useTranslation('merchant');
  const query = useBooking(bookingId);
  const quote = useQuoteBooking();
  const errorMessage = useSalesErrorMessage();
  const [price, setPrice] = useState('');
  const [due, setDue] = useState('0');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const priceXaf = parseWholeNumber(price);
    const dueXaf = parseWholeNumber(due);
    const minutes = duration ? parseWholeNumber(duration) : null;
    const next: Record<string, string> = {};
    if (priceXaf == null) next.price = tm('invalidNumber');
    if (dueXaf == null || (priceXaf != null && dueXaf > priceXaf)) next.due = tm('invalidNumber');
    const hasDate = day.trim().length > 0;
    if (
      hasDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(day.trim()) || !/^\d{2}:\d{2}$/.test(time.trim()))
    ) {
      next.day = tm('required');
    }
    if (hasDate && (minutes == null || minutes <= 0)) next.duration = tm('invalidNumber');
    setErrors(next);
    if (Object.keys(next).length > 0 || priceXaf == null || dueXaf == null) return;
    quote.mutate(
      {
        bookingId,
        priceXaf,
        amountDueXaf: dueXaf,
        ...(hasDate && minutes
          ? { startsAt: cameroonInstant(day.trim(), time.trim()), durationMinutes: minutes }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <QueryState query={query}>
      {(booking) =>
        !booking ? (
          <Text tone="muted">{tc('notFound')}</Text>
        ) : (
          <>
            <BookingCard booking={booking} show="client" />
            {booking.clientMessage ? <Text tone="muted">« {booking.clientMessage} »</Text> : null}
            <TextField
              label={t('quotePrice')}
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              error={errors.price}
            />
            <TextField
              label={t('quoteDue')}
              value={due}
              onChangeText={setDue}
              keyboardType="number-pad"
              error={errors.due}
            />
            <Text variant="caption" tone="muted">
              {t('quoteDueHint')}
            </Text>
            <TextField
              label={t('quoteDay')}
              value={day}
              onChangeText={setDay}
              placeholder="2026-12-01"
              error={errors.day}
            />
            <TextField
              label={t('quoteTime')}
              value={time}
              onChangeText={setTime}
              placeholder="10:00"
            />
            <TextField
              label={t('quoteDuration')}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              error={errors.duration}
            />
            <TextField label={t('quoteNote')} value={note} onChangeText={setNote} multiline />
            <Button label={t('sendQuote')} loading={quote.isPending} onPress={submit} />
            {quote.error ? <Text tone="muted">{errorMessage(quote.error)}</Text> : null}
          </>
        )
      }
    </QueryState>
  );
}
