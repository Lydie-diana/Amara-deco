import { cartCount, useCart, useMerchants, useSession } from '@amara/api';
import { LanguageToggle, MerchantCard, QueryState } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, fonts, Logo, Screen, space, Text } from '@amara/ui';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const CATEGORIES = [
  { key: 'sculpture', color: colors.clay },
  { key: 'furniture', color: colors.olive },
  { key: 'textile', color: colors.ochre },
  { key: 'lighting', color: colors.sand },
  { key: 'services', color: colors.paper },
] as const;

export default function Home() {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('catalog');
  const { t: tcart } = useTranslation('cart');
  const { t: ts } = useTranslation('sales');
  const { t: tmsg } = useTranslation('messages');
  const { t: ta } = useTranslation('ateliers');
  const merchants = useMerchants();
  const { session } = useSession();
  const count = cartCount(useCart());

  return (
    <Screen>
      <View style={styles.header}>
        <Logo />
        <LanguageToggle />
      </View>

      <View style={styles.shortcuts}>
        <Shortcut label={ta('shortcut')} onPress={() => router.push('/ateliers')} />
        <Shortcut label={tcart('open', { count })} onPress={() => router.push('/panier')} />
        {session ? (
          <>
            <Shortcut label={ts('myPurchases')} onPress={() => router.push('/achats')} />
            <Shortcut label={tmsg('title')} onPress={() => router.push('/messages')} />
          </>
        ) : null}
      </View>

      <View style={styles.hero}>
        <Text variant="display">
          {t('title')}{' '}
          <Text variant="display" italic tone="brand" inline>
            {t('titleAccent')}
          </Text>
        </Text>
        <Text tone="muted">{t('subtitle')}</Text>
      </View>

      <Pressable
        accessibilityRole="search"
        onPress={() => router.push('/recherche')}
        style={styles.search}
      >
        <Text tone="muted">{tc('searchPlaceholder')}</Text>
      </Pressable>

      <View style={{ gap: space.md }}>
        <Text variant="eyebrow" tone="muted">
          {t('categories')}
        </Text>
        <View style={styles.categories}>
          {CATEGORIES.map(({ key, color }) => (
            <View key={key} style={styles.category}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: color },
                  color === colors.paper && { borderWidth: 1.5, borderColor: colors.olive },
                ]}
              />
              <Text variant="caption" style={{ fontFamily: fonts.bodySemibold }}>
                {t(key)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <Text variant="title">{tc('discoverShops')}</Text>
        <QueryState query={merchants}>
          {(list) =>
            list.length === 0 ? (
              <Text tone="muted">{tc('noShops')}</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.md }}
              >
                {list.map((m) => (
                  <MerchantCard key={m.id} merchant={m} />
                ))}
              </ScrollView>
            )
          }
        </QueryState>
      </View>

      {session ? null : (
        <Button label={t('signIn')} variant="secondary" onPress={() => router.push('/connexion')} />
      )}
    </Screen>
  );
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.shortcut}>
      <Text variant="caption" style={{ fontFamily: fonts.bodySemibold, color: colors.ebony }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  shortcut: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.sandLine,
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { gap: space.sm },
  search: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.sand,
    backgroundColor: colors.paper,
    paddingHorizontal: space.lg - 4,
    justifyContent: 'center',
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 4 },
  category: { alignItems: 'center', gap: space.sm, width: 58 },
  dot: { width: 52, height: 52, borderRadius: 26 },
});
