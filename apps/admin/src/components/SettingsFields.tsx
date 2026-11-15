import { useTranslation } from '@amara/i18n';
import { Button, space, Text, TextField } from '@amara/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** Une clé secrète : jamais relue, seulement remplacée (texte saisi) ou effacée (''). */
export type SecretDraft = string | undefined;

/** Champ d'une clé secrète : indique si elle est enregistrée, permet de la remplacer ou l'effacer. */
export function SecretField({
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
  const { t } = useTranslation('secretField');
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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  secretActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

/** Mise en page commune des écrans de réglages d'Amara Admin. */
export const settingsStyles = StyleSheet.create({
  card: { gap: space.lg, padding: space.lg, maxWidth: 640 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
});
