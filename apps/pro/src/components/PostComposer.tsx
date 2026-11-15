import { useCreatePost, type PickedMedia, type PostKind } from '@amara/api';
import { Tabs } from '@amara/features';
import { useTranslation } from '@amara/i18n';
import { Button, colors, radius, space, Text, TextField } from '@amara/ui';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

const KNOWN_ERRORS = [
  'invalid_media_count',
  'unsupported_media',
  'video_too_long',
  'too_large',
] as const;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  const type = asset.type === 'video' ? 'video' : 'image';
  const extension = (asset.fileName ?? asset.uri).split('?')[0]!.split('.').pop()?.toLowerCase();
  return {
    uri: asset.uri,
    type,
    mimeType: asset.mimeType ?? MIME_BY_EXTENSION[extension ?? ''] ?? '',
    width: asset.width || undefined,
    height: asset.height || undefined,
    durationMs: asset.duration ?? undefined,
    sizeBytes: asset.fileSize ?? undefined,
  };
}

/** Amara Pro : choisir des photos ou vidéos, écrire une légende, envoyer pour validation. */
export function PostComposer({ merchantId }: { merchantId: string }) {
  const { t } = useTranslation('ateliers');
  const create = useCreatePost();
  const [kind, setKind] = useState<PostKind>('post');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<PickedMedia[]>([]);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: kind === 'post',
      selectionLimit: kind === 'post' ? 10 : 1,
      quality: 0.85,
      videoMaxDuration: 180,
      // Convertit les photos HEIC de l'iPhone en JPEG, lisible partout.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled) {
      create.reset();
      setMedia(result.assets.map(toPicked));
    }
  };

  const errorCode = create.error?.message;
  const error = create.isError
    ? t(
        `errors.${KNOWN_ERRORS.includes(errorCode as (typeof KNOWN_ERRORS)[number]) ? errorCode : 'generic'}`,
      )
    : null;

  return (
    <View style={styles.card}>
      <Text variant="title">{t('newPost')}</Text>
      <Tabs
        value={kind}
        onChange={(k) => {
          setKind(k);
          if (k === 'status') setMedia((m) => m.slice(0, 1));
        }}
        items={[
          { key: 'post', label: t('kindPost') },
          { key: 'status', label: t('kindStatus') },
        ]}
      />
      <Text variant="caption" tone="muted">
        {kind === 'post' ? t('kindPostHint') : t('kindStatusHint')}
      </Text>

      {media.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.previews}>
            {media.map((m) => (
              <View key={m.uri} style={styles.preview}>
                {m.type === 'image' ? (
                  <Image source={{ uri: m.uri }} style={StyleSheet.absoluteFill} />
                ) : (
                  <Text variant="caption" tone="inverse">
                    ▶ {m.durationMs ? `${Math.round(m.durationMs / 1000)} s` : ''}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      <Button
        label={media.length ? t('pickMore') : t('pick')}
        variant="secondary"
        onPress={() => void pick()}
      />
      <Text variant="caption" tone="muted">
        {t('pickHint')}
      </Text>

      <TextField
        label={t('caption')}
        placeholder={t('captionHint')}
        value={caption}
        onChangeText={setCaption}
        multiline
        maxLength={2200}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <Button
        label={t('publish')}
        disabled={media.length === 0}
        loading={create.isPending}
        onPress={() =>
          create.mutate(
            { merchantId, kind, caption, media },
            {
              onSuccess: () => {
                setMedia([]);
                setCaption('');
              },
            },
          )
        }
      />
      {create.isSuccess ? <Text tone="brand">{t('sent')}</Text> : null}
      {error ? <Text style={{ color: colors.clay }}>{error}</Text> : null}
      <Text variant="caption" tone="muted">
        {t('moderationNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sandLine,
    padding: space.lg,
    gap: space.md,
  },
  previews: { flexDirection: 'row', gap: space.sm },
  preview: {
    width: 88,
    height: 110,
    borderTopLeftRadius: 44,
    borderTopRightRadius: 44,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
