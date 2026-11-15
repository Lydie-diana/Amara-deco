import type { ReviewStatus } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { colors, fonts, radius, space } from '@amara/ui';
import { Text, View } from 'react-native';

const TONES: Record<ReviewStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.ochre, fg: colors.ebony },
  approved: { bg: colors.olive, fg: colors.paper },
  rejected: { bg: colors.sand, fg: colors.clay },
};

/** État de validation d'une publication. */
export function ReviewPill({ status }: { status: ReviewStatus }) {
  const { t } = useTranslation('ateliers');
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
        {t(`review.${status}`)}
      </Text>
    </View>
  );
}
