import { useMyMerchant } from '@amara/api';
import {
  LanguageToggle,
  ProductRow,
  QueryState,
  RequireSession,
  ServiceRow,
} from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, Logo, Screen, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CreateMerchantForm } from '../components/CreateMerchantForm';

export default function Dashboard() {
  return (
    <RequireSession badge="PRO">
      <Screen>
        <MyShop />
      </Screen>
    </RequireSession>
  );
}

function MyShop() {
  const { t } = useTranslation('merchant');
  const { t: tc } = useTranslation('catalog');
  const { t: tp } = useTranslation('pro');
  const query = useMyMerchant();

  return (
    <QueryState query={query}>
      {(data) =>
        !data ? (
          <CreateMerchantForm />
        ) : (
          <View style={{ gap: space.lg }}>
            <View style={styles.banner}>
              <View style={styles.bannerTop}>
                <Logo badge="PRO" inverse size={22} />
                <LanguageToggle />
              </View>
              <Text variant="title" tone="inverse">
                {tp('welcome')}, {data.merchant.name}
              </Text>
              <Text
                variant="caption"
                style={{ color: colors.sand }}
                accessibilityLiveRegion="polite"
              >
                {data.merchant.reviewStatus === 'approved'
                  ? t('statusApproved')
                  : data.merchant.reviewStatus === 'rejected'
                    ? t('statusRejected', { note: data.merchant.reviewNote ?? '' })
                    : t('statusPending')}
              </Text>
            </View>

            <View style={{ gap: space.md }}>
              <Text variant="title">{tc('products')}</Text>
              {data.products.length ? (
                data.products.map((p) => <ProductRow key={p.id} product={p} linked={false} />)
              ) : (
                <Text tone="muted">{tc('noProducts')}</Text>
              )}
              <Button
                label={t('addProduct')}
                variant="secondary"
                onPress={() => router.push('/nouvel-objet')}
              />
            </View>

            <View style={{ gap: space.md }}>
              <Text variant="title">{tc('services')}</Text>
              {data.services.length ? (
                data.services.map((s) => <ServiceRow key={s.id} service={s} />)
              ) : (
                <Text tone="muted">{tc('noServices')}</Text>
              )}
              <Button
                label={t('addService')}
                variant="secondary"
                onPress={() => router.push('/nouveau-service')}
              />
            </View>
          </View>
        )
      }
    </QueryState>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.olive, borderRadius: 32, padding: space.lg, gap: space.sm },
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
});
