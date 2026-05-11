import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '@/constants';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface WeekCardProps {
  /** 7-length mask, Mon→Sun, true if any meal is planned that day. */
  plannedDays: boolean[];
}

export function WeekCard({ plannedDays }: WeekCardProps) {
  const router = useRouter();
  const totalMeals = 7;
  const mealsPlanned = plannedDays.filter(Boolean).length;
  const spotsLeft = totalMeals - mealsPlanned;

  return (
    <LinearGradient
      colors={['#3D1C0A', colors.espresso, '#1A1008']}
      start={{ x: 0.85, y: 0 }}
      end={{ x: 0.1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.left}>
          <Text style={styles.overline}>this week</Text>
          <View style={styles.countRow}>
            <Text style={styles.count}>{mealsPlanned}</Text>
            <Text style={styles.countSuffix}>/{totalMeals}</Text>
          </View>
          <Text style={styles.subtext}>meals planned · {spotsLeft} open</Text>
        </View>
        <TouchableOpacity
          style={styles.plannerBtn}
          onPress={() => router.push('/(tabs)/plan')}
          activeOpacity={0.8}
        >
          <Text style={styles.plannerBtnText}>Planner →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.barsRow}>
        {DAYS.map((day, i) => (
          <View key={i} style={styles.dayCol}>
            <View style={[styles.bar, plannedDays[i] ? styles.barFilled : styles.barEmpty]} />
            <Text style={styles.dayLabel}>{day}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.xl2,
    gap: spacing.xl2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    gap: 2,
  },
  overline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(250,232,218,0.6)',
    marginBottom: 4,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  count: {
    fontFamily: fonts.display,
    fontSize: 52,
    color: colors.textOnDark,
    lineHeight: 56,
  },
  countSuffix: {
    fontFamily: fonts.bodyRegular,
    fontSize: 20,
    color: 'rgba(250,232,218,0.45)',
  },
  subtext: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(250,232,218,0.6)',
    marginTop: 2,
  },
  plannerBtn: {
    backgroundColor: 'rgba(245,239,224,0.12)',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(245,239,224,0.18)',
  },
  plannerBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textOnDark,
  },
  barsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  barFilled: {
    backgroundColor: colors.terra,
  },
  barEmpty: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dayLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    color: 'rgba(250,232,218,0.4)',
    letterSpacing: 0.3,
  },
});
