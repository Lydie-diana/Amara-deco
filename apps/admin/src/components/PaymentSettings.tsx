import {
  usePaymentSettings,
  useSavePaymentSettings,
  type PaymentMode,
  type PaymentProviderId,
  type PaymentSettings,
} from '@amara/api';
import { cardStyle, QueryState, Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, space, Text, TextField } from '@amara/ui';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

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

/** Une clé secrète : jamais relue, seulement remplacée (texte saisi) ou effacée (''). */
type SecretDraft = string | undefined;

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
    <View style={[cardStyle, styles.card]}>
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
        </>
      ) : null}

      <View style={styles.footer}>
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

function SecretField({
  label,
  saved,
  value,
  onChange,
}: {
  label: string;
  saved: boolean;
  value: SecretDraft;
  onChange: (v: SecretDraft) => void;
}) {
  const { t } = useTranslation('paymentSettings');
  const removing = value === '';
  return (
    <View style={{ gap: space.xs }}>
      <TextField
        label={`${label} · ${removing ? t('removing') : saved ? t('saved') : t('notSaved')}`}
        value={value ?? ''}
        onChangeText={(v) => onChange(v === '' ? undefined : v)}
        placeholder={saved ? '••••••••' : undefined}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      {saved ? (
        <View style={styles.secretActions}>
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {t('keepHint')}
          </Text>
          {!removing ? (
            <Button label={t('remove')} variant="ghost" onPress={() => onChange('')} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg, padding: space.lg, maxWidth: 640 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  secretActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
