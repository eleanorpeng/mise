import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { colors, fonts, spacing, radius } from '@/constants';
import type { TechniqueAnnotation } from '@/types';

interface TechniqueChipProps {
  annotation: TechniqueAnnotation;
}

export function TechniqueChip({ annotation }: TechniqueChipProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>{annotation.technique}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.explanation}>
          <Text style={styles.explanationText}>{annotation.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'flex-start' },
  chip: {
    backgroundColor: colors.blush,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.brick },
  explanation: {
    backgroundColor: colors.linen,
    borderRadius: radius.input,
    padding: spacing.md,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  explanationText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.espresso,
    lineHeight: 19,
  },
});
