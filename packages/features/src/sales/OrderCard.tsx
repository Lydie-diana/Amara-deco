import type { Order } from '@amara/api';
import { formatXaf } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, space, Text } from '@amara/ui';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { StatusPill } from './StatusPill';

export interface OrderCardProps {
  order: Order;
  /** Montrer la boutique (client) ou l'adresse de livraison (artisan, admin). */
  show: 'shop' | 'delivery';
  onPress?: () => void;
  children?: ReactNode;
}

export function OrderCard({ order, show, onPress, children }: OrderCardProps) {
  const { t } = useTranslation('sales');
  const items = order.items.map((i) => `${i.quantity} × ${i.title}`).join(', ');
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
          {t('orderRef', { ref: order.reference })}
        </Text>
        <StatusPill status={order.status} />
      </View>
      <Text style={{ fontFamily: fonts.bodyBold }}>
        {show === 'shop'
          ? order.merchantName
          : t('deliveryTo', { place: `${order.deliveryAddress}, ${order.deliveryCity}` })}
      </Text>
      <Text tone="muted">{items}</Text>
      <Text variant="title" style={{ fontSize: 18 }}>
        {formatXaf(order.subtotalXaf)}
      </Text>
      {children}
    </Pressable>
  );
}
