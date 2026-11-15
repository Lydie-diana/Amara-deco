import {
  useIsAdmin,
  usePendingMerchants,
  useReviewMerchant,
  type MerchantWithReview,
} from '@amara/api';
import { cardStyle, LanguageToggle, QueryState, RequireSession, Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, Logo, Screen, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AssistantSettingsPanel } from '../components/AssistantSettings';
import { ContentQueue } from '../components/ContentQueue';
import { PaymentSettingsPanel } from '../components/PaymentSettings';
import { AllBookings, AllOrders } from '../components/SalesTabs';

export default function AdminHome() {
  return (
    <RequireSession badge="ADMIN">
      <Screen maxWidth={1100}>
        <View style={styles.header}>
          <View style={styles.banner}>
            <Logo badge="ADMIN" inverse />
          </View>
          <LanguageToggle />
        </View>
        <AdminOnly />
      </Screen>
    </RequireSession>
  );
}

function AdminOnly() {
  const { t } = useTranslation('review');
  const isAdmin = useIsAdmin();
  return (
    <QueryState query={isAdmin}>
      {(ok) => (ok ? <Console /> : <Text tone="muted">{t('notAdmin')}</Text>)}
    </QueryState>
  );
}

function Console() {
  const { t } = useTranslation('sales');
  const { t: ta } = useTranslation('admin');
  const { t: tp } = useTranslation('paymentSettings');
  const { t: tat } = useTranslation('ateliers');
  const { t: tas } = useTranslation('assistantSettings');
  const [tab, setTab] = useState<
    'merchants' | 'content' | 'orders' | 'bookings' | 'payment' | 'assistant'
  >('merchants');
  return (
    <View style={{ gap: space.lg }}>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'merchants', label: ta('merchants') },
          { key: 'content', label: tat('adminTab') },
          { key: 'orders', label: t('orders') },
          { key: 'bookings', label: t('bookings') },
          { key: 'payment', label: tp('tab') },
          { key: 'assistant', label: tas('tab') },
        ]}
      />
      {tab === 'merchants' ? (
        <PendingMerchants />
      ) : tab === 'content' ? (
        <ContentQueue />
      ) : tab === 'orders' ? (
        <AllOrders />
      ) : tab === 'bookings' ? (
        <AllBookings />
      ) : tab === 'payment' ? (
        <PaymentSettingsPanel />
      ) : (
        <AssistantSettingsPanel />
      )}
    </View>
  );
}

function PendingMerchants() {
  const { t } = useTranslation('review');
  const pending = usePendingMerchants();
  return (
    <View style={{ gap: space.md }}>
      <Text variant="display">{t('title')}</Text>
      <QueryState query={pending}>
        {(list) =>
          list.length === 0 ? (
            <Text tone="muted">{t('empty')}</Text>
          ) : (
            <View style={styles.grid}>
              {list.map((m) => (
                <PendingCard key={m.id} merchant={m} />
              ))}
            </View>
          )
        }
      </QueryState>
    </View>
  );
}

function PendingCard({ merchant }: { merchant: MerchantWithReview }) {
  const { t, i18n } = useTranslation('review');
  const { t: tm } = useTranslation('merchant');
  const review = useReviewMerchant();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const kindKey = {
    artisan: 'kindArtisan',
    service_provider: 'kindService',
    both: 'kindBoth',
  } as const;

  return (
    <View style={[cardStyle, styles.card]}>
      <Text variant="title">{merchant.name}</Text>
      <Text variant="caption" tone="muted">
        {tm(kindKey[merchant.kind])} · {merchant.city} ·{' '}
        {t('submittedOn', {
          date: new Date(merchant.createdAt).toLocaleDateString(
            i18n.language === 'en' ? 'en-GB' : 'fr-FR',
          ),
        })}
      </Text>
      {merchant.bio ? <Text>{merchant.bio}</Text> : null}
      {rejecting ? (
        <View style={{ gap: space.sm }}>
          <TextField label={t('rejectNote')} value={note} onChangeText={setNote} />
          <Button
            label={t('reject')}
            onPress={() =>
              review.mutate({
                merchantId: merchant.id,
                decision: 'rejected',
                note: note.trim() || undefined,
              })
            }
            loading={review.isPending}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('approve')}
            onPress={() => review.mutate({ merchantId: merchant.id, decision: 'approved' })}
            loading={review.isPending}
          />
          <Button label={t('reject')} variant="secondary" onPress={() => setRejecting(true)} />
        </View>
      )}
      {review.isError ? (
        <Text variant="caption" style={{ color: colors.clay }}>
          {String(review.error.message)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  banner: {
    backgroundColor: colors.ebony,
    borderRadius: 24,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { flexGrow: 1, flexBasis: 320, gap: space.sm, padding: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
