import { useMerchantHours, useSaveMerchantHours, type MerchantHours } from '@amara/api';
import { QueryState } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, radius, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { ChipToggle } from '../components/ChipToggle';
import { MyShopScreen } from '../components/MyShopScreen';

export default function Hours() {
  const { t } = useTranslation('hours');
  return (
    <MyShopScreen title={t('title')}>
      {(merchant) => <HoursLoader merchantId={merchant.id} />}
    </MyShopScreen>
  );
}

function HoursLoader({ merchantId }: { merchantId: string }) {
  const query = useMerchantHours(merchantId);
  return (
    <QueryState query={query}>
      {(hours) => <HoursForm merchantId={merchantId} initial={hours} />}
    </QueryState>
  );
}

interface Day {
  open: boolean;
  opensAt: string;
  closesAt: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function HoursForm({ merchantId, initial }: { merchantId: string; initial: MerchantHours[] }) {
  const { t } = useTranslation('hours');
  const names = t('days', { returnObjects: true }) as unknown as string[];
  const save = useSaveMerchantHours();
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Une plage par jour, du lundi (1) au dimanche (7).
  const [days, setDays] = useState<Day[]>(() =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const h = initial.find((x) => x.weekday === weekday);
      return h
        ? { open: true, opensAt: h.opensAt, closesAt: h.closesAt }
        : { open: false, opensAt: '09:00', closesAt: '17:00' };
    }),
  );

  const update = (index: number, patch: Partial<Day>) => {
    setSaved(false);
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const submit = () => {
    const open = days.map((d, i) => ({ ...d, weekday: i + 1 })).filter((d) => d.open);
    const bad = open.some(
      (d) => !TIME.test(d.opensAt) || !TIME.test(d.closesAt) || d.closesAt <= d.opensAt,
    );
    setInvalid(bad);
    if (bad) return;
    save.mutate(
      {
        merchantId,
        hours: open.map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt })),
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <>
      <Text tone="muted">{t('intro')}</Text>
      {days.map((d, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.paper,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.sand,
            padding: space.md,
            gap: space.sm,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text variant="title" style={{ fontSize: 18 }}>
              {names[i]}
            </Text>
            <ChipToggle
              value={d.open ? ['open'] : []}
              onChange={(next) => update(i, { open: next.includes('open') })}
              items={[{ key: 'open', label: d.open ? t('open') : t('closed') }]}
            />
          </View>
          {d.open ? (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('opensAt')}
                  value={d.opensAt}
                  onChangeText={(v) => update(i, { opensAt: v })}
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('closesAt')}
                  value={d.closesAt}
                  onChangeText={(v) => update(i, { closesAt: v })}
                  placeholder="17:00"
                />
              </View>
            </View>
          ) : null}
        </View>
      ))}
      {invalid ? <Text style={{ color: colors.clay }}>{t('invalid')}</Text> : null}
      <Button label={t('save')} loading={save.isPending} onPress={submit} />
      {saved ? (
        <Text tone="muted" accessibilityLiveRegion="polite">
          {t('saved')}
        </Text>
      ) : null}
    </>
  );
}
