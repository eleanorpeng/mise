import { useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing } from '@/constants';
import { Avatar } from '@/components/ui/Avatar';
import { BottomFade } from '@/components/ui/BottomFade';
import { WeekCard } from '@/components/home/WeekCard';
import { ImportBar } from '@/components/home/ImportBar';
import { GroceryPeek } from '@/components/home/GroceryPeek';
import { RecentlySaved } from '@/components/home/RecentlySaved';
import { CookLogPeek } from '@/components/home/CookLogPeek';
import { useGreeting } from '@/hooks/useGreeting';
import { usePlanStore, getMondayIso } from '@/store/plan';

function currentWeekStartIso(): string {
  return getMondayIso();
}

function dayIndex(weekStart: string, plannedDate: string): number {
  // Mon=0, Sun=6. Returns -1 if outside the week.
  const a = new Date(weekStart + 'T00:00:00');
  const b = new Date(plannedDate + 'T00:00:00');
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff >= 0 && diff < 7 ? diff : -1;
}

export default function HomeScreen() {
  const { sublabel, title } = useGreeting();
  const router = useRouter();

  const weekStart = currentWeekStartIso();
  const weekPlan = usePlanStore((s) => s.weeks[weekStart]);
  const fetchWeek = usePlanStore((s) => s.fetchWeek);

  useEffect(() => {
    fetchWeek(weekStart).catch(() => {});
  }, [fetchWeek, weekStart]);

  const plannedDays = useMemo(() => {
    const mask = [false, false, false, false, false, false, false];
    if (!weekPlan) return mask;
    for (const entry of weekPlan.entries) {
      const i = dayIndex(weekPlan.weekStart, entry.plannedDate);
      if (i >= 0) mask[i] = true;
    }
    return mask;
  }, [weekPlan]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>mise</Text>
          <Avatar initials="E" onPress={() => router.push('/(tabs)/profile')} />
        </View>

        <View style={styles.greeting}>
          <Text style={styles.greetingSub}>{sublabel}</Text>
          <Text style={styles.greetingTitle}>{title}</Text>
        </View>

        <WeekCard plannedDays={plannedDays} />
        <ImportBar />
        <CookLogPeek />
        <GroceryPeek />
        <RecentlySaved />
      </ScrollView>

      <BottomFade />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  content: { paddingBottom: 120 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.espresso,
    letterSpacing: 0.3,
  },
  greeting: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  greetingSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 4,
  },
  greetingTitle: {
    ...typeScale.h1,
    color: colors.espresso,
  },
});
