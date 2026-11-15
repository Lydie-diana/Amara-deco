import type { BookingStatus, OrderStatus } from '@amara/api';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, space } from '@amara/ui';
import { Text, View } from 'react-native';

const TONES: Record<OrderStatus | BookingStatus, { bg: string; fg: string }> = {
  awaiting_payment: { bg: colors.ochre, fg: colors.ebony },
  requested: { bg: colors.sand, fg: colors.ebony },
  quoted: { bg: colors.ochre, fg: colors.ebony },
  paid: { bg: colors.olive, fg: colors.paper },
  accepted: { bg: colors.olive, fg: colors.paper },
  preparing: { bg: colors.olive, fg: colors.paper },
  confirmed: { bg: colors.olive, fg: colors.paper },
  delivered: { bg: colors.ebony, fg: colors.paper },
  completed: { bg: colors.ebony, fg: colors.paper },
  cancelled: { bg: colors.sand, fg: colors.stone },
  declined: { bg: colors.sand, fg: colors.stone },
};

export function StatusPill({ status }: { status: OrderStatus | BookingStatus }) {
  const { t } = useTranslation('sales');
  const tone = TONES[status];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: tone.bg,
        borderRadius: radius.pill,
        paddingHorizontal: space.sm + 4,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: tone.fg }}>
        {t(`status.${status}`)}
      </Text>
    </View>
  );
}
