import { TextInput, View, Text, StyleSheet, type TextInputProps } from 'react-native';
import { colors, fonts, spacing, radius } from '@/constants';

interface InputProps extends TextInputProps {
  label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.umber}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.linen,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: radius.inner,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
  },
});
