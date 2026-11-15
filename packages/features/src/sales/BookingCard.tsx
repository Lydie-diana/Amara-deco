import type { Booking } from '@amara/api';
import { formatDateTime, formatXaf } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, radius, space, Text } from '@amara/ui';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { StatusPill } from './StatusPill';

export interface BookingCardProps {
  booking: Booking;
  show: 'shop' | 'client';
  onPress?: () => void;
  children?: ReactNode;
}

export function BookingCard({ booking, show, onPress, children }: BookingCardProps) {
  const { t, i18n } = useTranslation('sales');
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      style={{
        backgroundColor: colors.paper,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.sand,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="eyebrow" tone="muted">
          {t('bookingRef', { ref: booking.reference })}
        </Text>
        <StatusPill status={booking.status} />
      </View>
      <Text variant="title" style={{ fontSize: 18 }}>
        {booking.serviceTitle}
      </Text>
      <Text tone="muted">
        {show === 'shop'
          ? booking.merchantName
          : [booking.address, booking.city].filter(Boolean).join(', ')}
      </Text>
      {booking.startsAt ? (
        <Text>{t('whenLabel', { when: formatDateTime(booking.startsAt, i18n.language) })}</Text>
      ) : null}
      {booking.priceXaf != null && booking.status !== 'requested' ? (
        <Text>
          {booking.mode === 'quote'
            ? t('quoteFrom', {
                price: formatXaf(booking.priceXaf),
                due: formatXaf(booking.amountDueXaf),
              })
            : formatXaf(booking.priceXaf)}
        </Text>
      ) : null}
      {children}
    </Pressable>
  );
}
