import { useAvailableSlots, useRequestBooking, useService } from '@amara/api';
import { formatDay, formatTime, upcomingDays, type BookingMode } from '@amara/core';
import {
  BackButton,
  QueryState,
  RequireSession,
  Tabs,
  useSalesErrorMessage,
} from '@amara/features';
import { useTranslation } from '@amara/i18n';
import {
  Button,
  colors,
  fonts,
  radius,
  Screen,
  space,
  Text,
  TextField,
  touchTarget,
} from '@amara/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

const DAYS_AHEAD = 14;

export default function Reserve() {
  return (
    <RequireSession>
      <ReserveForm />
    </RequireSession>
  );
}

function ReserveForm() {
  const { service: serviceId = '' } = useLocalSearchParams<{ service: string }>();
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('catalog');
  const query = useService(serviceId);

  return (
    <Screen>
      <BackButton />
      <QueryState query={query}>
        {(data) =>
          !data ? (
            <Text tone="muted">{tc('notFound')}</Text>
          ) : (
            <BookingForm
              serviceId={data.service.id}
              title={data.service.title}
              shop={data.merchant.name}
              defaultCity={data.merchant.city}
              modes={data.service.bookingModes}
            />
          )
        }
      </QueryState>
    </Screen>
  );
}

function BookingForm({
  serviceId,
  title,
  shop,
  defaultCity,
  modes,
}: {
  serviceId: string;
  title: string;
  shop: string;
  defaultCity: string;
  modes: BookingMode[];
}) {
  const { t, i18n } = useTranslation('sales');
  const { t: tc } = useTranslation('catalog');
  const { t: tm } = useTranslation('merchant');
  const [mode, setMode] = useState<BookingMode>(modes[0] ?? 'quote');
  const days = upcomingDays(DAYS_AHEAD);
  const [day, setDay] = useState(days[0] ?? '');
  const [slot, setSlot] = useState<string | null>(null);
  const [city, setCity] = useState(defaultCity);
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const slots = useAvailableSlots(mode === 'slot' ? serviceId : '', day);
  const request = useRequestBooking();
  const errorMessage = useSalesErrorMessage();

  const submit = () => {
    if (city.trim().length < 2) return setError(tm('required'));
    if (mode === 'slot' && !slot) return setError(t('chooseSlot'));
    if (mode === 'quote' && message.trim().length < 3) return setError(tm('required'));
    setError(null);
    request.mutate(
      {
        serviceId,
        mode,
        city: city.trim(),
        ...(mode === 'slot' && slot ? { startsAt: slot } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      },
      {
        onSuccess: (booking) =>
          router.replace({ pathname: '/achats/reservation/[id]', params: { id: booking.id } }),
        onError: () => setSlot(null),
      },
    );
  };

  return (
    <>
      <Text variant="eyebrow" tone="brand">
        {shop}
      </Text>
      <Text variant="display">{title}</Text>

      {modes.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" style={{ fontFamily: fonts.bodySemibold }}>
            {t('chooseMode')}
          </Text>
          <Tabs
            value={mode}
            onChange={setMode}
            items={modes.map((m) => ({
              key: m,
              label: m === 'slot' ? tc('bySlot') : tc('byQuote'),
            }))}
          />
        </View>
      ) : null}

      {mode === 'slot' ? (
        <>
          <Text variant="caption" style={{ fontFamily: fonts.bodySemibold }}>
            {t('chooseDay')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            {days.map((d) => (
              <Chip
                key={d}
                label={formatDay(d, i18n.language)}
                selected={d === day}
                onPress={() => {
                  setDay(d);
                  setSlot(null);
                }}
              />
            ))}
          </ScrollView>
          <Text variant="caption" style={{ fontFamily: fonts.bodySemibold }}>
            {t('chooseSlot')}
          </Text>
          <QueryState query={slots}>
            {(list) =>
              list.length === 0 ? (
                <Text tone="muted">{t('noSlots')}</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {list.map((s) => (
                    <Chip
                      key={s}
                      label={formatTime(s, i18n.language)}
                      selected={s === slot}
                      onPress={() => setSlot(s)}
                    />
                  ))}
                </View>
              )
            }
          </QueryState>
        </>
      ) : null}

      <TextField label={t('city')} value={city} onChangeText={setCity} />
      <TextField label={t('address')} value={address} onChangeText={setAddress} />
      <TextField
        label={mode === 'quote' ? t('message') : t('messageOptional')}
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Button
        label={mode === 'slot' ? t('confirmSlot') : t('requestQuote')}
        loading={request.isPending}
        onPress={submit}
      />
      {error || request.error ? (
        <Text tone="muted" accessibilityLiveRegion="polite">
          {error ?? errorMessage(request.error)}
        </Text>
      ) : null}
    </>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: touchTarget,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? colors.clay : colors.paper,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.sandLine,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodySemibold,
          fontSize: 14,
          color: selected ? colors.paper : colors.ebony,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
