import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import { usePlanStore, getMondayIso } from '@/store/plan';

function currentWeekStartIso(): string {
  return getMondayIso();
}

export function GroceryPeek() {
  const router = useRouter();
  const weekStart = currentWeekStartIso();
  const items = usePlanStore((s) => s.groceryByWeek[weekStart] ?? []);
  const fetchGroceryList = usePlanStore((s) => s.fetchGroceryList);

  useEffect(() => {
    fetchGroceryList(weekStart).catch(() => {});
  }, [fetchGroceryList, weekStart]);

  const total = items.length;
  const doneCount = items.filter((i) => i.checked).length;
  const fillWidth = total > 0 ? Math.round((doneCount / total) * 48) : 0;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => router.push('/(tabs)/plan?tab=grocery')}
        activeOpacity={0.8}
      >
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="format-list-checks" size={16} color={colors.sage} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Grocery list</Text>
          <Text style={styles.headerSub}>
            {total === 0
              ? 'Plan some meals to build your list'
              : `${doneCount} of ${total} items ticked off`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {total > 0 && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: fillWidth }]} />
            </View>
          )}
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.umber} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.inner - 2,
    backgroundColor: colors.sagePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  headerSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.linen,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.sage,
  },
});
