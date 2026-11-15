import { View, type ViewProps } from 'react-native';

import { colors } from './tokens';

export interface ArchProps extends ViewProps {
  width: number;
  height: number;
  color?: string;
  /** Rayon des coins bas. */
  footRadius?: number;
}

/** La forme signature d'Amara : une arche, qui cadre les photos et les visuels. */
export function Arch({
  width,
  height,
  color = colors.sand,
  footRadius = 12,
  style,
  ...rest
}: ArchProps) {
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: color,
          borderTopLeftRadius: width / 2,
          borderTopRightRadius: width / 2,
          borderBottomLeftRadius: footRadius,
          borderBottomRightRadius: footRadius,
          overflow: 'hidden',
        },
        style,
      ]}
      {...rest}
    />
  );
}
