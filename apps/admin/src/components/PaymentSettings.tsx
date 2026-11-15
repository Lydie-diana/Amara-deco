import {
  usePaymentSettings,
  useSavePaymentSettings,
  type PaymentMode,
  type PaymentProviderId,
  type PaymentSettings,
} from '@amara/api';
import { cardStyle, QueryState, Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, radius, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Field, SecretField, settingsStyles, type SecretDraft } from './SettingsFields';

/** Écran « Paiement » : la super admin choisit le prestataire et saisit ses accès. */
export function PaymentSettingsPanel() {
  const { t } = useTranslation('paymentSettings');
  const query = usePaymentSettings();
  return (
    <View style={{ gap: space.md }}>
      <Text variant="display">{t('title')}</Text>
      <Text tone="muted">{t('intro')}</Text>
      <QueryState query={query}>
        {(settings) => <SettingsForm key={settings.updatedAt ?? 'new'} settings={settings} />}
      </QueryState>
    </View>
  );
}

/** Adresse à déclarer chez le prestataire pour qu'il prévienne Amara de chaque paiement. */
const WEBHOOK_URL = `${(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')}/functions/v1/payments-webhook`;
const WEBHOOK_EVENTS = [
  'checkout.completed',
  'checkout.expired',
  'payment.succeeded',
  'payment.failed',
];

function SettingsForm({ settings }: { settings: PaymentSettings }) {
  const { t, i18n } = useTranslation('paymentSettings');
  const save = useSavePaymentSettings();
  const [provider, setProvider] = useState<PaymentProviderId>(settings.provider);
  const [mode, setMode] = useState<PaymentMode>(settings.mode);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? '');
  const [publicKey, setPublicKey] = useState(settings.publicKey ?? '');
  const [secretKey, setSecretKey] = useState<SecretDraft>(undefined);
  const [webhookSecret, setWebhookSecret] = useState<SecretDraft>(undefined);

  const providers: PaymentProviderId[] = settings.mockAllowed
    ? ['none', 'honelia', 'mock']
    : ['none', 'honelia'];
  const needsCredentials = provider === 'honelia';
  const urlInvalid = baseUrl.trim() !== '' && !/^https:\/\/\S+$/.test(baseUrl.trim());

  const errorCode = save.error?.message;
  const errorText = save.isError
    ? t(
        `errors.${errorCode === 'missing_credentials' || errorCode === 'mock_not_allowed' ? errorCode : 'generic'}`,
      )
    : null;

  return (
    <View style={[cardStyle, settingsStyles.card]}>
      <Field label={t('provider')}>
        <Tabs
          value={provider}
          onChange={setProvider}
          items={providers.map((p) => ({ key: p, label: t(`providers.${p}`) }))}
        />
      </Field>

      {needsCredentials ? (
        <>
          <Field label={t('mode')}>
            <Tabs
              value={mode}
              onChange={setMode}
              items={(['sandbox', 'live'] as const).map((m) => ({
                key: m,
                label: t(`modes.${m}`),
              }))}
            />
            {mode === 'live' ? (
              <Text variant="caption" style={{ color: colors.clay }}>
                {t('liveWarning')}
              </Text>
            ) : null}
          </Field>
          <TextField
            label={t('baseUrl')}
            placeholder={t('baseUrlHint')}
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={urlInvalid ? t('errors.invalid_url') : null}
          />
          <TextField
            label={t('publicKey')}
            value={publicKey}
            onChangeText={setPublicKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <SecretField
            label={t('secretKey')}
            saved={settings.hasSecretKey}
            value={secretKey}
            onChange={setSecretKey}
          />
          <SecretField
            label={t('webhookSecret')}
            saved={settings.hasWebhookSecret}
            value={webhookSecret}
            onChange={setWebhookSecret}
          />
          <Text variant="caption" tone="muted">
            {t('secretsNote')}
          </Text>
          <View style={styles.webhook}>
            <Text variant="caption">{t('webhookTitle')}</Text>
            <Text selectable style={styles.mono}>
              {WEBHOOK_URL}
            </Text>
            <Text variant="caption" tone="muted">
              {t('webhookEvents')}
            </Text>
            <Text selectable variant="caption" style={styles.mono}>
              {WEBHOOK_EVENTS.join(', ')}
            </Text>
          </View>
        </>
      ) : null}

      <View style={settingsStyles.footer}>
        <Button
          label={t('save')}
          loading={save.isPending}
          disabled={urlInvalid}
          onPress={() =>
            save.mutate({ provider, mode, baseUrl, publicKey, secretKey, webhookSecret })
          }
        />
        {save.isSuccess ? <Text tone="muted">{t('savedOk')}</Text> : null}
        {errorText ? <Text style={{ color: colors.clay }}>{errorText}</Text> : null}
      </View>
      {settings.updatedAt ? (
        <Text variant="caption" tone="muted">
          {t('updatedAt', {
            date: new Date(settings.updatedAt).toLocaleString(
              i18n.language === 'en' ? 'en-GB' : 'fr-FR',
              { timeZone: 'Africa/Douala' },
            ),
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webhook: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.sand,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
