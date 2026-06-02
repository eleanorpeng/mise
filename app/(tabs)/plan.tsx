import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing } from '@/constants';
import { usePlanStore, getMondayIso, addWeeks } from '@/store/plan';
import { usePreferencesStore } from '@/store/preferences';
import { Segmented, type PlanTab } from '@/components/plan/Segmented';
import { WeekHeader } from '@/components/plan/WeekHeader';
import { DayRow } from '@/components/plan/DayRow';
import { RecipePickerSheet } from '@/components/plan/RecipePickerSheet';
import { MealActionsSheet } from '@/components/plan/MealActionsSheet';
import { GroceryListView } from '@/components/plan/GroceryListView';
import { BottomFade } from '@/components/ui/BottomFade';
import type { PlannedMeal } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDays(weekStart: string): Date[] {
  const start = parseIso(weekStart);
  const arr: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(d);
  }
  return arr;
}

export default function PlanScreen() {
  const router = useRouter();
  const showMacros = usePreferencesStore((s) => s.showMacros);

  const viewWeekStart = usePlanStore((s) => s.viewWeekStart);
  const setViewWeek = usePlanStore((s) => s.setViewWeek);
  const fetchWeek = usePlanStore((s) => s.fetchWeek);
  const weeks = usePlanStore((s) => s.weeks);
  const removeEntry = usePlanStore((s) => s.removeEntry);
  const updateEntry = usePlanStore((s) => s.updateEntry);
  const toggleCooked = usePlanStore((s) => s.toggleCooked);
  const groceryByWeek = usePlanStore((s) => s.groceryByWeek);

  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<PlanTab>(
    params.tab === 'grocery' ? 'grocery' : 'plan',
  );
  const [pagerEnabled, setPagerEnabled] = useState(true);

  // Allow deep-linking to the grocery view (e.g. from the home peek).
  useEffect(() => {
    if (params.tab === 'grocery') setTab('grocery');
    else if (params.tab === 'plan') setTab('plan');
  }, [params.tab]);

  // Sheets state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState<string>('');
  const [actionsVisible, setActionsVisible] = useState(false);
  const [actionsEntry, setActionsEntry] = useState<PlannedMeal | null>(null);

  // Pager: render 3 weeks side-by-side (prev / current / next).
  const pagerRef = useRef<ScrollView>(null);
  const settlingRef = useRef(false);

  const pageWeeks = useMemo(() => {
    return [
      addWeeks(viewWeekStart, -1),
      viewWeekStart,
      addWeeks(viewWeekStart, 1),
    ];
  }, [viewWeekStart]);

  // Reset pager to centered page whenever the view week changes.
  useEffect(() => {
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: SCREEN_WIDTH, y: 0, animated: false });
    });
  }, [viewWeekStart]);

  // Fetch the visible weeks (current + neighbors so swipe is instant).
  useEffect(() => {
    pageWeeks.forEach((w) => {
      if (!weeks[w]) fetchWeek(w);
    });
  }, [pageWeeks, weeks, fetchWeek]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (settlingRef.current) return;
    const x = e.nativeEvent.contentOffset.x;
    const page = Math.round(x / SCREEN_WIDTH);
    if (page === 0) {
      settlingRef.current = true;
      setViewWeek(addWeeks(viewWeekStart, -1));
      setTimeout(() => (settlingRef.current = false), 50);
    } else if (page === 2) {
      settlingRef.current = true;
      setViewWeek(addWeeks(viewWeekStart, 1));
      setTimeout(() => (settlingRef.current = false), 50);
    }
  };

  const handlePrev = () => setViewWeek(addWeeks(viewWeekStart, -1));
  const handleNext = () => setViewWeek(addWeeks(viewWeekStart, 1));
  const handleToday = () => setViewWeek(getMondayIso());

  const openPickerForDay = (iso: string) => {
    setPickerDate(iso);
    setPickerVisible(true);
  };

  const openActionsFor = (entry: PlannedMeal) => {
    setActionsEntry(entry);
    setActionsVisible(true);
  };

  const groceryCount = (groceryByWeek[viewWeekStart] ?? []).filter((i) => !i.checked).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <WeekHeader
        weekStart={viewWeekStart}
        onPrev={handlePrev}
        onNext={handleNext}
        onJumpToToday={handleToday}
      />
      <Segmented value={tab} onChange={setTab} groceryCount={groceryCount} />

      {tab === 'plan' ? (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          scrollEnabled={pagerEnabled}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          contentContainerStyle={{ flexGrow: 0 }}
          style={{ flex: 1 }}
        >
          {pageWeeks.map((weekStart) => (
            <WeekColumn
              key={weekStart}
              weekStart={weekStart}
              showMacros={showMacros}
              entries={weeks[weekStart]?.entries ?? []}
              onAdd={openPickerForDay}
              onPressMeal={(entry) => router.push(`/recipe/${entry.recipeId}?from=plan`)}
              onLongPressMeal={openActionsFor}
              onToggleCooked={(entry) => toggleCooked(entry, weekStart)}
              onRemove={(entry) => removeEntry(entry.id, weekStart)}
              setPagerEnabled={setPagerEnabled}
            />
          ))}
        </ScrollView>
      ) : (
        <GroceryListView weekStart={viewWeekStart} />
      )}

      <RecipePickerSheet
        visible={pickerVisible}
        targetDate={pickerDate}
        onClose={() => setPickerVisible(false)}
      />

      <MealActionsSheet
        visible={actionsVisible}
        entry={actionsEntry}
        weekStart={viewWeekStart}
        onClose={() => setActionsVisible(false)}
        onView={(entry) => router.push(`/recipe/${entry.recipeId}?from=plan`)}
        onToggleCooked={(entry) => toggleCooked(entry, viewWeekStart)}
        onMoveToDate={(entry, isoDate) =>
          updateEntry(entry.id, { plannedDate: isoDate }, viewWeekStart)
        }
        onRemove={(entry) => removeEntry(entry.id, viewWeekStart)}
      />

      <BottomFade />
    </SafeAreaView>
  );
}

interface WeekColumnProps {
  weekStart: string;
  entries: PlannedMeal[];
  showMacros: boolean;
  onAdd: (iso: string) => void;
  onPressMeal: (entry: PlannedMeal) => void;
  onLongPressMeal: (entry: PlannedMeal) => void;
  onToggleCooked: (entry: PlannedMeal) => void;
  onRemove: (entry: PlannedMeal) => void;
  setPagerEnabled?: (enabled: boolean) => void;
}

function WeekColumn({
  weekStart,
  entries,
  showMacros,
  onAdd,
  onPressMeal,
  onLongPressMeal,
  onToggleCooked,
  onRemove,
  setPagerEnabled,
}: WeekColumnProps) {
  const days = useMemo(() => buildDays(weekStart), [weekStart]);
  const todayIso = toIso(new Date());

  const entriesByDay = useMemo(() => {
    const map = new Map<string, PlannedMeal[]>();
    for (const e of entries) {
      const list = map.get(e.plannedDate) ?? [];
      list.push(e);
      map.set(e.plannedDate, list);
    }
    // Order within day by meal type
    const order: Record<PlannedMeal['mealType'], number> = {
      breakfast: 0,
      lunch: 1,
      dinner: 2,
      snack: 3,
    };
    map.forEach((list) =>
      list.sort((a, b) => order[a.mealType] - order[b.mealType]),
    );
    return map;
  }, [entries]);

  return (
    <ScrollView
      style={{ width: SCREEN_WIDTH }}
      contentContainerStyle={styles.weekContent}
      showsVerticalScrollIndicator={false}
    >
      {days.map((d) => {
        const iso = toIso(d);
        const dayEntries = entriesByDay.get(iso) ?? [];
        const isToday = iso === todayIso;
        const isPast = iso < todayIso && !isToday;
        return (
          <DayRow
            key={iso}
            date={d}
            isToday={isToday}
            isPast={isPast}
            entries={dayEntries}
            showMacros={showMacros}
            onAdd={() => onAdd(iso)}
            onPressMeal={onPressMeal}
            onLongPressMeal={onLongPressMeal}
            onToggleCooked={onToggleCooked}
            onRemoveMeal={onRemove}
            setPagerEnabled={setPagerEnabled}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  weekContent: {
    paddingTop: spacing.sm,
    paddingBottom: 140,
  },
});
