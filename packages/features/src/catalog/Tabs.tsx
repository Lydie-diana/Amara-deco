import { colors, fonts, radius, space, touchTarget } from '@amara/ui';
import { Pressable, Text, View } from 'react-native';

export interface TabsProps<K extends string> {
  value: K;
  onChange: (key: K) => void;
  items: readonly { key: K; label: string }[];
}

/** Onglets en pilules (Objets / Services, filtres…). */
export function Tabs<K extends string>({ value, onChange, items }: TabsProps<K>) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.key)}
            style={{
              minHeight: touchTarget - 4,
              paddingHorizontal: space.md + 4,
              borderRadius: radius.pill,
              justifyContent: 'center',
              backgroundColor: selected ? colors.ebony : 'transparent',
              borderWidth: selected ? 0 : 1,
              borderColor: colors.sandLine,
            }}
          >
            <Text
              style={{
                fontFamily: selected ? fonts.bodyBold : fonts.bodySemibold,
                fontSize: 14,
                color: selected ? colors.paper : colors.ebony,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
