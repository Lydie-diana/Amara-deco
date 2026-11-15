import { colors, fonts, radius, space, touchTarget } from '@amara/ui';
import { Pressable, Text, View } from 'react-native';

/** Plusieurs choix possibles (par exemple : créneau et devis). */
export function ChipToggle<K extends string>({
  value,
  onChange,
  items,
}: {
  value: readonly K[];
  onChange: (next: K[]) => void;
  items: readonly { key: K; label: string }[];
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((item) => {
        const on = value.includes(item.key);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() =>
              onChange(on ? value.filter((k) => k !== item.key) : [...value, item.key])
            }
            style={{
              minHeight: touchTarget - 4,
              paddingHorizontal: space.md + 4,
              borderRadius: radius.pill,
              justifyContent: 'center',
              backgroundColor: on ? colors.olive : 'transparent',
              borderWidth: on ? 0 : 1,
              borderColor: colors.sandLine,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bodySemibold,
                fontSize: 14,
                color: on ? colors.paper : colors.ebony,
              }}
            >
              {(on ? '✓ ' : '') + item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
