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

type ViewMode = 'week' | 'month' | 'year';

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
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoOf(date: Date): string {
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function mondayIndex(year: number, month: number): number {
  // Day-of-week of the 1st with Monday = 0, Sunday = 6.
  const sunIndex = new Date(year, month, 1).getDay();
  return (sunIndex + 6) % 7;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const offset = (day + 6) % 7; // Monday-based
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatMonthShort(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export default function CookScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const todayIsoStr = isoOf(today);
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState<Date>(today);

  const fetchMonth = useCookLogStore((s) => s.fetchMonth);
  const logsByMonth = useCookLogStore((s) => s.logsByMonth);
  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);

  // The months we need fetched for the current view.
  const monthsToFetch = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      const months = new Set<string>();
      months.add(monthKey(start.getFullYear(), start.getMonth()));
      months.add(monthKey(end.getFullYear(), end.getMonth()));
      return Array.from(months);
    }
    if (view === 'month') {
      return [monthKey(cursor.getFullYear(), cursor.getMonth())];
    }
    // year
    return Array.from({ length: 12 }, (_, m) =>
      monthKey(cursor.getFullYear(), m),
    );
  }, [view, cursor]);

  const monthsKey = monthsToFetch.join('|');

  useFocusEffect(
    useCallback(() => {
      monthsToFetch.forEach((m) => fetchMonth(m));
      if (recipes.length === 0) fetchRecipes();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monthsKey, fetchMonth, fetchRecipes, recipes.length]),
  );

  // Flatten the relevant months into a date → log map.
  const logsByDate = useMemo(() => {
    const map: Record<string, CookLog> = {};
    for (const m of monthsToFetch) {
      const logs = logsByMonth[m] ?? [];
      for (const log of logs) {
        if (!map[log.cookedDate]) map[log.cookedDate] = log;
      }
    }
    return map;
  }, [monthsKey, logsByMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Range covered by the current view (for stats + sticker wall).
  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 6) };
    }
    if (view === 'month') {
      return {
        start: new Date(cursor.getFullYear(), cursor.getMonth(), 1),
        end: new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          daysInMonth(cursor.getFullYear(), cursor.getMonth()),
        ),
      };
    }
    return {
      start: new Date(cursor.getFullYear(), 0, 1),
      end: new Date(cursor.getFullYear(), 11, 31),
    };
  }, [view, cursor]);

  const logsInRange = useMemo(() => {
    const start = isoOf(range.start);
    const end = isoOf(range.end);
    return Object.values(logsByDate).filter(
      (l) => l.cookedDate >= start && l.cookedDate <= end,
    );
  }, [logsByDate, range]);

  const stickerItems = useMemo(
    () => logsInRange.map((l) => ({ id: l.id, uri: l.stickerUrl })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logsInRange.map((l) => l.id).join('|')],
  );

  const totalCooks = logsInRange.length;
  // daysCovered = elapsed days in the visible period. For past periods that's
  // the full length; for the current period it's clamped to today so the
  // average isn't deflated by future days that haven't happened yet.
  const daysCovered = useMemo(() => {
    const msPerDay = 86400000;
    const dayDiff = (a: Date, b: Date) =>
      Math.floor((b.getTime() - a.getTime()) / msPerDay) + 1;

    if (view === 'week') {
      const weekStart = startOfWeek(cursor);
      const weekEnd = addDays(weekStart, 6);
      const sameWeek = weekStart.getTime() === startOfWeek(today).getTime();
      return sameWeek ? dayDiff(weekStart, today) : 7;
    }
    if (view === 'month') {
      const monthLen = daysInMonth(cursor.getFullYear(), cursor.getMonth());
      const sameMonth =
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth() === today.getMonth();
      return sameMonth ? Math.min(today.getDate(), monthLen) : monthLen;
    }
    // year
    const y = cursor.getFullYear();
    const yearStart = new Date(y, 0, 1);
    if (y === today.getFullYear()) return dayDiff(yearStart, today);
    const yearEnd = new Date(y, 11, 31);
    return dayDiff(yearStart, yearEnd);
  }, [view, cursor, today]);
  const dailyAvg = daysCovered > 0 ? totalCooks / daysCovered : 0;

  const topRecipe = useMemo(() => {
    if (logsInRange.length === 0) return null;
    const counts = new Map<string, number>();
    for (const log of logsInRange) {
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
  }, [logsInRange, recipes]);

  const periodLabel = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      return sameMonth
        ? `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`
        : `${formatMonthShort(start)} – ${formatMonthShort(end)}`;
    }
    if (view === 'month') {
      return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
    return `${cursor.getFullYear()}`;
  }, [view, cursor]);

  const periodCompact = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor);
      return `Week of ${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
    }
    if (view === 'month') {
      return `${MONTH_SHORT[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
    return `${cursor.getFullYear()}`;
  }, [view, cursor]);

  const statsScope =
    view === 'week' ? 'This week' : view === 'month' ? 'This month' : 'This year';

  const isAtPresent = useMemo(() => {
    if (view === 'week') {
      const todayWeek = startOfWeek(today);
      const curWeek = startOfWeek(cursor);
      return todayWeek.getTime() === curWeek.getTime();
    }
    if (view === 'month') {
      return (
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth() === today.getMonth()
      );
    }
    return cursor.getFullYear() === today.getFullYear();
  }, [view, cursor, today]);

  const goPrev = () => {
    setCursor((c) => {
      if (view === 'week') return addDays(startOfWeek(c), -7);
      if (view === 'month')
        return new Date(c.getFullYear(), c.getMonth() - 1, 1);
      return new Date(c.getFullYear() - 1, 0, 1);
    });
  };
  const goNext = () => {
    if (isAtPresent) return;
    setCursor((c) => {
      if (view === 'week') return addDays(startOfWeek(c), 7);
      if (view === 'month')
        return new Date(c.getFullYear(), c.getMonth() + 1, 1);
      return new Date(c.getFullYear() + 1, 0, 1);
    });
  };

  const switchView = (next: ViewMode) => {
    setView(next);
    // Keep cursor anchored to a meaningful start for the new view.
    setCursor((c) => {
      if (next === 'week') return startOfWeek(c);
      if (next === 'month') return new Date(c.getFullYear(), c.getMonth(), 1);
      return new Date(c.getFullYear(), 0, 1);
    });
  };

  const handleCellPress = (dateIso: string) => {
    const existing = logsByDate[dateIso];
    if (existing) {
      router.push(`/cook-log/${existing.id}`);
    } else {
      router.push({ pathname: '/cook-log/new', params: { date: dateIso } });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.overline}>cook log</Text>
          <Text style={styles.title}>{periodLabel}</Text>
          <Text style={styles.subtitle}>
            {totalCooks === 0
              ? 'Snap a photo of what you cooked. We turn it into a sticker.'
              : `${totalCooks} ${totalCooks === 1 ? 'meal' : 'meals'} logged`}
          </Text>
        </View>

        <ViewToggle value={view} onChange={switchView} />

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
            <Text style={styles.monthLabelText}>{periodCompact}</Text>
          </View>
          <TouchableOpacity
            style={[styles.monthBtn, isAtPresent && styles.monthBtnDisabled]}
            onPress={goNext}
            activeOpacity={isAtPresent ? 1 : 0.7}
            disabled={isAtPresent}
            hitSlop={12}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={isAtPresent ? colors.sand : colors.espresso}
            />
          </TouchableOpacity>
        </View>

        {view === 'week' && (
          <WeekView
            weekStart={startOfWeek(cursor)}
            logsByDate={logsByDate}
            todayIso={todayIsoStr}
            onPress={handleCellPress}
          />
        )}
        {view === 'month' && (
          <MonthView
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            logsByDate={logsByDate}
            todayIso={todayIsoStr}
            onPress={handleCellPress}
          />
        )}
        {view === 'year' && (
          <YearView
            year={cursor.getFullYear()}
            logsByDate={logsByDate}
            todayIso={todayIsoStr}
            onPress={handleCellPress}
          />
        )}

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
            <Text style={styles.wallOverline}>your {view}, plated</Text>
            <StickerWall items={stickerItems} />
          </View>
        )}

        <View style={styles.statsCard}>
          <Text style={styles.statsHeading}>{statsScope}</Text>
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

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const tabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];
  return (
    <View style={styles.toggleWrap}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onChange(t.id)}
            style={[styles.toggleTab, active && styles.toggleTabActive]}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.toggleLabel, active && styles.toggleLabelActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type CalendarProps = {
  logsByDate: Record<string, CookLog>;
  todayIso: string;
  onPress: (dateIso: string) => void;
};

function WeekView({
  weekStart,
  ...rest
}: CalendarProps & { weekStart: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <View style={styles.calendar}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.weekRowGrid}>
        {days.map((d) => {
          const iso = isoOf(d);
          return (
            <DayCell
              key={iso}
              day={d.getDate()}
              dateIso={iso}
              log={rest.logsByDate[iso]}
              isToday={iso === rest.todayIso}
              onPress={rest.onPress}
              dayNumberSize="lg"
            />
          );
        })}
      </View>
    </View>
  );
}

function MonthView({
  year,
  month,
  ...rest
}: CalendarProps & { year: number; month: number }) {
  const totalDays = daysInMonth(year, month);
  const offset = mondayIndex(year, month);
  const weeks = useMemo(() => {
    type Cell = { key: string; day: number | null; date: string | null };
    const flat: Cell[] = [];
    for (let i = 0; i < offset; i++) {
      flat.push({ key: `pad-${i}`, day: null, date: null });
    }
    for (let day = 1; day <= totalDays; day++) {
      const date = isoDate(year, month, day);
      flat.push({ key: date, day, date });
    }
    while (flat.length % 7 !== 0) {
      flat.push({ key: `pad-end-${flat.length}`, day: null, date: null });
    }
    const rows: Cell[][] = [];
    for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
    return rows;
  }, [year, month, totalDays, offset]);

  return (
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
              return (
                <DayCell
                  key={cell.key}
                  day={cell.day}
                  dateIso={cell.date}
                  log={rest.logsByDate[cell.date]}
                  isToday={cell.date === rest.todayIso}
                  onPress={rest.onPress}
                  dayNumberSize="md"
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function YearView({
  year,
  ...rest
}: CalendarProps & { year: number }) {
  return (
    <View style={styles.yearWrap}>
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          logsByDate={rest.logsByDate}
          todayIso={rest.todayIso}
          onPress={rest.onPress}
        />
      ))}
    </View>
  );
}

function MiniMonth({
  year,
  month,
  ...rest
}: CalendarProps & { year: number; month: number }) {
  const totalDays = daysInMonth(year, month);
  const offset = mondayIndex(year, month);
  const cells = useMemo(() => {
    type Cell = { key: string; day: number | null; date: string | null };
    const flat: Cell[] = [];
    for (let i = 0; i < offset; i++) {
      flat.push({ key: `p-${i}`, day: null, date: null });
    }
    for (let day = 1; day <= totalDays; day++) {
      const date = isoDate(year, month, day);
      flat.push({ key: date, day, date });
    }
    while (flat.length % 7 !== 0) {
      flat.push({ key: `pe-${flat.length}`, day: null, date: null });
    }
    return flat;
  }, [year, month, totalDays, offset]);

  return (
    <View style={styles.miniMonth}>
      <Text style={styles.miniMonthLabel}>{MONTH_SHORT[month]}</Text>
      <View style={styles.miniGrid}>
        {cells.map((cell) => {
          if (cell.day === null || cell.date === null) {
            return <View key={cell.key} style={styles.miniCellEmpty} />;
          }
          return (
            <DayCell
              key={cell.key}
              day={cell.day}
              dateIso={cell.date}
              log={rest.logsByDate[cell.date]}
              isToday={cell.date === rest.todayIso}
              onPress={rest.onPress}
              dayNumberSize="xs"
              cellStyle={styles.miniCell}
            />
          );
        })}
      </View>
    </View>
  );
}

function DayCell({
  day,
  dateIso,
  log,
  isToday,
  onPress,
  dayNumberSize,
  cellStyle,
}: {
  day: number;
  dateIso: string;
  log: CookLog | undefined;
  isToday: boolean;
  onPress: (iso: string) => void;
  dayNumberSize: 'xs' | 'md' | 'lg';
  cellStyle?: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.cell, cellStyle, isToday && styles.cellToday]}
      onPress={() => onPress(dateIso)}
      activeOpacity={0.7}
    >
      {log ? <Sticker uri={log.stickerUrl} style={styles.sticker} /> : null}
      {dayNumberSize !== 'xs' && (
        <Text
          style={[
            dayNumberSize === 'lg' ? styles.dayNumberLg : styles.dayNumber,
            log && styles.dayNumberWithSticker,
          ]}
        >
          {day}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const CELL_GAP = 6;
const MINI_CELL_GAP = 2;

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

  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: colors.linen,
    borderRadius: radius.pill,
    padding: 4,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  toggleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  toggleTabActive: {
    backgroundColor: colors.cardBg,
  },
  toggleLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  toggleLabelActive: {
    color: colors.espresso,
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
  dayNumberLg: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.umber,
  },
  dayNumberWithSticker: {
    color: colors.espresso,
  },

  yearWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  miniMonth: {
    width: '47%',
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  miniMonthLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.umber,
    paddingHorizontal: 2,
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MINI_CELL_GAP,
  },
  miniCell: {
    width: `${(100 - MINI_CELL_GAP * 6) / 7}%`,
    aspectRatio: 1,
    borderRadius: 3,
  },
  miniCellEmpty: {
    width: `${(100 - MINI_CELL_GAP * 6) / 7}%`,
    aspectRatio: 1,
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
