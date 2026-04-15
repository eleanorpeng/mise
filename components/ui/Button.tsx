import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '@/constants';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textOnDark : colors.espresso}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.terra,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl2,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.sand,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  ghost: {
    backgroundColor: colors.linen,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 15,
  },
  primaryLabel: {
    fontFamily: fonts.bodyMedium,
    color: colors.textOnDark,
  },
  secondaryLabel: {
    fontFamily: fonts.bodyMedium,
    color: colors.espresso,
  },
  ghostLabel: {
    fontFamily: fonts.bodyMedium,
    color: colors.umber,
    fontSize: 15,
  },
});
