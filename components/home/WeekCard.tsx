import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Button } from '@/components/ui/Button';

interface WeekCardProps {
  mealsPlanned: number;
  totalMeals?: number;
}

export function WeekCard({ mealsPlanned, totalMeals = 7 }: WeekCardProps) {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.overline}>this week</Text>
        <View style={styles.countRow}>
          <Text style={styles.count}>{mealsPlanned}</Text>
          <Text style={styles.countTotal}>/{totalMeals}</Text>
        </View>
        <Text style={styles.subtext}>meals planned</Text>
      </View>
      <Button
        label="Open planner"
        variant="ghost"
        onPress={() => router.push('/(tabs)/plan')}
        style={styles.plannerButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.espresso,
    borderRadius: radius.hero,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  left: {
    gap: 2,
  },
  overline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  count: {
    ...typeScale.h1,
    color: colors.textOnDark,
  },
  countTotal: {
    fontFamily: fonts.bodyRegular,
    fontSize: 17,
    color: colors.umber,
  },
  subtext: {
    ...typeScale.caption,
    color: 'rgba(245,239,224,0.6)',
  },
  plannerButton: {
    backgroundColor: 'rgba(245,239,224,0.1)',
  },
});
