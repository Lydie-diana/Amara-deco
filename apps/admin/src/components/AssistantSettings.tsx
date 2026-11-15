import { useAssistantSettings, useSaveAssistantSettings, type AssistantSettings } from '@amara/api';
import { cardStyle, QueryState, Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { View } from 'react-native';

import { Field, SecretField, settingsStyles, type SecretDraft } from './SettingsFields';

const DEFAULT_MODEL = 'claude-opus-5-5';
const ERROR_CODES = ['missing_api_key', 'invalid_model', 'invalid_limit'] as const;

/** Écran « Assistant » : la super admin allume l'assistant IA et saisit la clé de l'API. */
export function AssistantSettingsPanel() {
  const { t } = useTranslation('assistantSettings');
  const query = useAssistantSettings();
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

function SettingsForm({ settings }: { settings: AssistantSettings }) {
  const { t } = useTranslation('assistantSettings');
  const save = useSaveAssistantSettings();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [model, setModel] = useState(settings.model || DEFAULT_MODEL);
  const [limit, setLimit] = useState(String(settings.dailyLimit));
  const [apiKey, setApiKey] = useState<SecretDraft>(undefined);

  const dailyLimit = Number(limit);
  const limitInvalid = !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000;
  const modelInvalid = !/^claude-[a-z0-9.-]+$/.test(model.trim());
  const code = save.error?.message ?? '';
  const errorText = save.isError
    ? t(`errors.${(ERROR_CODES as readonly string[]).includes(code) ? code : 'generic'}`)
    : null;

  return (
    <View style={[cardStyle, settingsStyles.card]}>
      <Field label={t('status')}>
        <Tabs
          value={enabled ? 'on' : 'off'}
          onChange={(v) => setEnabled(v === 'on')}
          items={[
            { key: 'off', label: t('off') },
            { key: 'on', label: t('on') },
          ]}
        />
      </Field>
      <SecretField
        label={t('apiKey')}
        saved={settings.hasApiKey}
        value={apiKey}
        onChange={setApiKey}
      />
      <Text variant="caption" tone="muted">
        {t('apiKeyHint')}
      </Text>
      <TextField
        label={t('model')}
        value={model}
        onChangeText={setModel}
        autoCapitalize="none"
        autoCorrect={false}
        error={modelInvalid ? t('errors.invalid_model') : null}
      />
      <TextField
        label={t('dailyLimit')}
        value={limit}
        onChangeText={setLimit}
        keyboardType="number-pad"
        error={limitInvalid ? t('errors.invalid_limit') : null}
      />
      <Text variant="caption" tone="muted">
        {t('dailyLimitHint')}
      </Text>
      <View style={settingsStyles.footer}>
        <Button
          label={t('save')}
          loading={save.isPending}
          disabled={limitInvalid || modelInvalid}
          onPress={() => save.mutate({ enabled, model: model.trim(), dailyLimit, apiKey })}
        />
        {save.isSuccess ? <Text tone="muted">{t('savedOk')}</Text> : null}
        {errorText ? <Text style={{ color: colors.clay }}>{errorText}</Text> : null}
      </View>
    </View>
  );
}
