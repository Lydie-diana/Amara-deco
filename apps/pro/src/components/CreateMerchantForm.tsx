import { useCreateMerchant, type NewMerchant } from '@amara/api';
import { slugify } from '@amara/core';
import { Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { View } from 'react-native';

type Kind = NewMerchant['kind'];

export function CreateMerchantForm() {
  const { t } = useTranslation('merchant');
  const create = useCreateMerchant();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [kind, setKind] = useState<Kind>('artisan');
  const [showErrors, setShowErrors] = useState(false);

  const effectiveSlug = slugEdited ? slugify(slug) : slugify(name);
  const missing = {
    name: name.trim().length < 2,
    slug: effectiveSlug.length < 3,
    city: city.trim().length < 2,
  };
  const slugTaken = (create.error as { code?: string } | null)?.code === '23505';

  function submit() {
    if (missing.name || missing.slug || missing.city) {
      setShowErrors(true);
      return;
    }
    create.mutate({
      name: name.trim(),
      slug: effectiveSlug,
      city: city.trim(),
      bio: bio.trim() || undefined,
      kind,
    });
  }

  return (
    <View style={{ gap: space.md }}>
      <Text variant="display">{t('createTitle')}</Text>
      <Text tone="muted">{t('createIntro')}</Text>
      <TextField
        label={t('name')}
        value={name}
        onChangeText={setName}
        error={showErrors && missing.name ? t('required') : null}
      />
      <TextField
        label={t('slug')}
        value={slugEdited ? slug : effectiveSlug}
        onChangeText={(v) => {
          setSlugEdited(true);
          setSlug(v);
        }}
        autoCapitalize="none"
        error={slugTaken ? t('slugTaken') : showErrors && missing.slug ? t('required') : null}
      />
      <Text variant="caption" tone="muted">
        {t('slugHint', { slug: effectiveSlug || '…' })}
      </Text>
      <TextField
        label={t('city')}
        value={city}
        onChangeText={setCity}
        error={showErrors && missing.city ? t('required') : null}
      />
      <Text variant="caption" style={{ color: colors.ebony }}>
        {t('kind')}
      </Text>
      <Tabs
        value={kind}
        onChange={setKind}
        items={[
          { key: 'artisan', label: t('kindArtisan') },
          { key: 'service_provider', label: t('kindService') },
          { key: 'both', label: t('kindBoth') },
        ]}
      />
      <TextField
        label={t('bio')}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={600}
        style={{ minHeight: 96, borderRadius: 20, paddingTop: 14 }}
      />
      <Button label={t('create')} onPress={submit} loading={create.isPending} />
    </View>
  );
}
