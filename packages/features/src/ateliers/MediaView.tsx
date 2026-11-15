import type { PostMedia } from '@amara/api';
import { colors } from '@amara/ui';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, View, type ImageStyle, type ViewStyle } from 'react-native';

export interface MediaViewProps {
  media: PostMedia;
  /** « cover » remplit le cadre (fil), « contain » montre tout (statuts). */
  fit?: 'cover' | 'contain';
  /** Lecture automatique, en boucle et sans le son (statuts). Sinon, commandes du lecteur. */
  autoPlay?: boolean;
  style?: ViewStyle;
}

/** Une photo ou une vidéo d'Atelier. */
export function MediaView({ media, fit = 'cover', autoPlay = false, style }: MediaViewProps) {
  if (!media.url) return <View style={[{ backgroundColor: colors.sand }, style]} />;
  return media.type === 'video' ? (
    <Video url={media.url} fit={fit} autoPlay={autoPlay} style={style} />
  ) : (
    <Image
      source={{ uri: media.url }}
      resizeMode={fit}
      accessibilityIgnoresInvertColors
      style={[{ backgroundColor: colors.sand }, style as ImageStyle]}
    />
  );
}

function Video({
  url,
  fit,
  autoPlay,
  style,
}: {
  url: string;
  fit: 'cover' | 'contain';
  autoPlay: boolean;
  style?: ViewStyle;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    if (autoPlay) {
      p.muted = true;
      p.play();
    }
  });
  return (
    <VideoView
      player={player}
      contentFit={fit}
      nativeControls={!autoPlay}
      fullscreenOptions={{ enable: true }}
      style={[{ backgroundColor: colors.ebony }, style]}
    />
  );
}
