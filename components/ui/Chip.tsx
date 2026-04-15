import { TouchableOpacity, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '@/constants';

type ChipVariant = 'technique' | 'saved' | 'neutral';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, variant = 'neutral', onPress, style }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  technique: { backgroundColor: colors.blush },
  saved: { backgroundColor: colors.sagePale },
  neutral: { backgroundColor: colors.linen },
  label: { fontSize: 12 },
  techniqueLabel: { fontFamily: fonts.bodyMedium, color: colors.brick },
  savedLabel: { fontFamily: fonts.bodyMedium, color: '#3A5C2A' },
  neutralLabel: { fontFamily: fonts.bodyRegular, color: colors.umber },
});
