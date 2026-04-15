import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radius } from '@/constants';

interface ToastProps {
  message: string;
  variant?: 'success' | 'error';
}

export function Toast({ message, variant = 'success' }: ToastProps) {
  return (
    <View style={[styles.base, styles[variant]]}>
      <View style={[styles.dot, styles[`${variant}Dot`]]} />
      <Text style={[styles.message, styles[`${variant}Message`]]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.inner,
    padding: spacing.md,
    gap: spacing.sm,
  },
  success: { backgroundColor: colors.espresso },
  error: { backgroundColor: colors.blush },
  dot: { width: 6, height: 6, borderRadius: 3 },
  successDot: { backgroundColor: colors.sage },
  errorDot: { backgroundColor: colors.rust },
  message: { fontFamily: fonts.bodyRegular, fontSize: 14, flex: 1 },
  successMessage: { color: colors.oat },
  errorMessage: { color: colors.brick },
});
