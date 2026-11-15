import { toSearchQuery, useSearch } from '@amara/api';
import { BackButton, MerchantCard, ProductRow, QueryState, ServiceRow } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Screen, space, Text, TextField } from '@amara/ui';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

/** Attend une courte pause dans la frappe avant de lancer la recherche (économise le réseau). */
function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function Search() {
  const { t } = useTranslation('catalog');
  const [input, setInput] = useState('');
  const term = useDebounced(input);
  const query = useSearch(term);
  const ready = toSearchQuery(term) != null;

  return (
    <Screen>
      <BackButton />
      <TextField
        label={t('searchLabel')}
        placeholder={t('searchPlaceholder')}
        value={input}
        onChangeText={setInput}
        autoFocus
        returnKeyType="search"
        accessibilityRole="search"
      />
      {!ready ? (
        <Text tone="muted">{t('searchHint')}</Text>
      ) : (
        <QueryState query={query}>
          {(r) =>
            r.products.length + r.services.length + r.merchants.length === 0 ? (
              <Text tone="muted">{t('searchEmpty')}</Text>
            ) : (
              <View style={{ gap: space.lg }}>
                {r.merchants.length ? (
                  <View style={{ gap: space.md }}>
                    <Text variant="eyebrow" tone="muted">
                      {t('shops')}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: space.md }}
                    >
                      {r.merchants.map((m) => (
                        <MerchantCard key={m.id} merchant={m} width={130} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {r.products.length ? (
                  <View style={{ gap: space.md }}>
                    <Text variant="eyebrow" tone="muted">
                      {t('products')}
                    </Text>
                    {r.products.map((p) => (
                      <ProductRow key={p.id} product={p} />
                    ))}
                  </View>
                ) : null}
                {r.services.length ? (
                  <View style={{ gap: space.md }}>
                    <Text variant="eyebrow" tone="muted">
                      {t('services')}
                    </Text>
                    {r.services.map((s) => (
                      <ServiceRow key={s.id} service={s} />
                    ))}
                  </View>
                ) : null}
              </View>
            )
          }
        </QueryState>
      )}
    </Screen>
  );
}
