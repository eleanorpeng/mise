import { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { useCookLogStore } from '@/store/cookLog';
import { useRecipesStore } from '@/store/recipes';
import { Sticker } from '@/components/ui/Sticker';
import { StickerWall } from '@/components/cook-log/StickerWall';
import { BottomFade } from '@/components/ui/BottomFade';
import type { CookLog } from '@/types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function mondayIndex(year: number, month: number): number {
  // Day-of-week of the 1st with Monday = 0, Sunday = 6.
  const sunIndex = new Date(year, month, 1).getDay();
  return (sunIndex + 6) % 7;
}

export default function CookScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const fetchMonth = useCookLogStore((s) => s.fetchMonth);
  const logsByMonth = useCookLogStore((s) => s.logsByMonth);
  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);

  const key = monthKey(cursor.year, cursor.month);
  const logs = logsByMonth[key] ?? [];

  useFocusEffect(
    useCallback(() => {
      fetchMonth(key);
      if (recipes.length === 0) fetchRecipes();
    }, [key, fetchMonth, fetchRecipes, recipes.length]),
  );

  const logsByDate = useMemo(() => {
    const map: Record<string, CookLog> = {};
    for (const log of logs) {
      // If multiple logs share a date, prefer the most recent (sorted desc already).
      if (!map[log.cookedDate]) map[log.cookedDate] = log;
    }
    return map;
  }, [logs]);

  // Stable identity: only changes when the actual sticker set changes, not on every fetch.
  const stickerItems = useMemo(
    () => logs.map((l) => ({ id: l.id, uri: l.stickerUrl })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs.map((l) => l.id).join('|')],
  );

  const totalCooks = logs.length;
  const daysInMonthCount = daysInMonth(cursor.year, cursor.month);
  const dailyAvg = totalCooks / daysInMonthCount;

  const topRecipe = useMemo(() => {
    if (logs.length === 0) return null;
    const counts = new Map<string, number>();
    for (const log of logs) {
      if (!log.recipeId) continue;
      counts.set(log.recipeId, (counts.get(log.recipeId) ?? 0) + 1);
    }
    let bestId: string | null = null;
    let bestCount = 0;
    for (const [id, count] of counts) {
      if (count > bestCount) {
        bestId = id;
        bestCount = count;
      }
    }
    if (!bestId) return null;
    const recipe = recipes.find((r) => r.id === bestId);
    return recipe ? { title: recipe.title, count: bestCount } : null;
  }, [logs, recipes]);

  const isCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const goPrev = () => {
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { year: c.year, month: c.month - 1 },
    );
  };

  const goNext = () => {
    if (isCurrentMonth) return;
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { year: c.year, month: c.month + 1 },
    );
  };

  const handleCellPress = (dateIso: string) => {
    const existing = logsByDate[dateIso];
    if (existing) {
      router.push(`/cook-log/${existing.id}`);
    } else {
      router.push({ pathname: '/cook-log/new', params: { date: dateIso } });
    }
  };

  const totalDays = daysInMonth(cursor.year, cursor.month);
  const offset = mondayIndex(cursor.year, cursor.month);
  const weeks = useMemo(() => {
    type Cell = { key: string; day: number | null; date: string | null };
    const flat: Cell[] = [];
    for (let i = 0; i < offset; i++) {
      flat.push({ key: `pad-${i}`, day: null, date: null });
    }
    for (let day = 1; day <= totalDays; day++) {
      const date = isoDate(cursor.year, cursor.month, day);
      flat.push({ key: date, day, date });
    }
    while (flat.length % 7 !== 0) {
      flat.push({ key: `pad-end-${flat.length}`, day: null, date: null });
    }
    const rows: Cell[][] = [];
    for (let i = 0; i < flat.length; i += 7) {
      rows.push(flat.slice(i, i + 7));
    }
    return rows;
  }, [cursor.year, cursor.month, totalDays, offset]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.overline}>cook log</Text>
          <Text style={styles.title}>
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </Text>
          <Text style={styles.subtitle}>
            {totalCooks === 0
              ? 'Snap a photo of what you cooked. We turn it into a sticker.'
              : `${totalCooks} ${totalCooks === 1 ? 'meal' : 'meals'} this month`}
          </Text>
        </View>

        <View style={styles.monthSwitcher}>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={goPrev}
            activeOpacity={0.7}
            hitSlop={12}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color={colors.espresso}
            />
          </TouchableOpacity>
          <View style={styles.monthLabel}>
            <Text style={styles.monthLabelText}>
              {MONTH_NAMES[cursor.month].slice(0, 3)} {cursor.year}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.monthBtn, isCurrentMonth && styles.monthBtnDisabled]}
            onPress={goNext}
            activeOpacity={isCurrentMonth ? 1 : 0.7}
            disabled={isCurrentMonth}
            hitSlop={12}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={isCurrentMonth ? colors.sand : colors.espresso}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.calendar}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.weekRowGrid}>
                {row.map((cell) => {
                  if (cell.day === null || cell.date === null) {
                    return <View key={cell.key} style={styles.cellEmpty} />;
                  }
                  const log = logsByDate[cell.date];
                  const isToday = cell.date === todayIso;
                  return (
                    <TouchableOpacity
                      key={cell.key}
                      style={[styles.cell, isToday && styles.cellToday]}
                      onPress={() => handleCellPress(cell.date!)}
                      activeOpacity={0.7}
                    >
                      {log ? (
                        <Sticker uri={log.stickerUrl} style={styles.sticker} borderScale={1.12} />
                      ) : null}
                      <Text
                        style={[
                          styles.dayNumber,
                          log && styles.dayNumberWithSticker,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/cook-log/new')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name="plus"
            size={20}
            color={colors.textOnDark}
          />
          <Text style={styles.addBtnText}>Log a cook</Text>
        </TouchableOpacity>

        {stickerItems.length >= 1 && (
          <View style={styles.wallSection}>
            <Text style={styles.wallOverline}>your month, plated</Text>
            <StickerWall items={stickerItems} />
          </View>
        )}

        <View style={styles.statsCard}>
          <Text style={styles.statsHeading}>This month</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Total cooks</Text>
              <Text style={styles.statValue}>{totalCooks}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Daily avg</Text>
              <Text style={styles.statValue}>{dailyAvg.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.statDividerH} />
          <Text style={styles.statLabel}>Most cooked</Text>
          {topRecipe ? (
            <Text style={styles.topRecipe} numberOfLines={1}>
              {topRecipe.title}
              <Text style={styles.topRecipeMeta}>
                {'  '}
                {topRecipe.count} {topRecipe.count === 1 ? 'cook' : 'cooks'}
              </Text>
            </Text>
          ) : (
            <Text style={styles.topRecipeEmpty}>
              Attach a recipe when you log a cook to see your favourite.
            </Text>
          )}
        </View>
      </ScrollView>
      <BottomFade />
    </SafeAreaView>
  );
}

const CELL_GAP = 6;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  content: { paddingBottom: 140 },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  overline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 6,
  },
  title: { ...typeScale.h1, color: colors.espresso },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    marginTop: 6,
    lineHeight: 20,
  },

  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnDisabled: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  monthLabel: {
    backgroundColor: colors.terra,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  monthLabelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textOnDark,
    letterSpacing: 0.4,
  },

  calendar: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginHorizontal: spacing.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    marginBottom: spacing.sm,
  },
  weekday: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: 'center',
    color: colors.umber,
    textTransform: 'uppercase',
  },
  grid: {
    gap: CELL_GAP,
  },
  weekRowGrid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.inner,
    backgroundColor: colors.linen,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellToday: {
    borderWidth: 1,
    borderColor: colors.espresso,
  },
  cellEmpty: {
    flex: 1,
    aspectRatio: 1,
  },
  sticker: {
    ...StyleSheet.absoluteFillObject,
    width: '110%',
    height: '110%',
    left: '-5%',
    top: '-5%',
  },
  dayNumber: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.umber,
  },
  dayNumberWithSticker: {
    color: colors.espresso,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.espresso,
  },
  addBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textOnDark,
    letterSpacing: 0.3,
  },

  wallSection: {
    marginTop: spacing.sm,
  },
  wallOverline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },

  statsCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statsHeading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statBlock: {
    flex: 1,
    gap: 2,
  },
  statDivider: {
    width: 0.5,
    height: 28,
    backgroundColor: colors.borderResting,
    marginHorizontal: spacing.md,
  },
  statDividerH: {
    height: 0.5,
    backgroundColor: colors.borderResting,
    marginVertical: spacing.sm,
  },
  statLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.espresso,
  },
  topRecipe: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
    marginTop: 2,
  },
  topRecipeMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  topRecipeEmpty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    marginTop: 2,
    lineHeight: 18,
  },
});
