import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import type { PlannedMeal, Macros } from '@/types';
import { MealCard } from './MealCard';

interface Props {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  entries: PlannedMeal[];
  showMacros: boolean;
  onAdd: () => void;
  onPressMeal: (entry: PlannedMeal) => void;
  onLongPressMeal: (entry: PlannedMeal) => void;
  onToggleCooked: (entry: PlannedMeal) => void;
  onRemoveMeal: (entry: PlannedMeal) => void;
  setPagerEnabled?: (enabled: boolean) => void;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function aggregateMacros(entries: PlannedMeal[]): Macros | null {
  let any = false;
  const total: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  for (const e of entries) {
    const m = e.recipe?.macros;
    if (!m) continue;
    any = true;
    const baseServ = e.recipe?.servings ?? 1;
    const factor = (e.servings || baseServ) / baseServ;
    total.calories += m.calories * factor;
    total.proteinG += m.proteinG * factor;
    total.carbsG += m.carbsG * factor;
    total.fatG += m.fatG * factor;
    if (m.fiberG) total.fiberG = (total.fiberG ?? 0) + m.fiberG * factor;
  }
  return any ? total : null;
}

export function DayRow({
  date,
  isToday,
  isPast,
  entries,
  showMacros,
  onAdd,
  onPressMeal,
  onLongPressMeal,
  onToggleCooked,
  onRemoveMeal,
  setPagerEnabled,
}: Props) {
  const dow = DOW[(date.getDay() + 6) % 7]; // Mon-first
  const dayNum = date.getDate();
  const macros = showMacros ? aggregateMacros(entries) : null;

  const Container: any = isToday ? LinearGradient : View;
  const containerProps: any = isToday
    ? {
        colors: ['rgba(232,122,74,0.10)', 'rgba(245,239,224,0)'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      }
    : {};

  return (
    <Container {...containerProps} style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.dow, isToday && styles.dowToday, isPast && styles.muted]}>
          {dow}
        </Text>
        <Text style={[styles.day, isToday && styles.dayToday, isPast && styles.muted]}>
          {dayNum}
        </Text>
      </View>

      <View style={styles.right}>
        {entries.length === 0 ? (
          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.85}
            style={styles.empty}
          >
            <MaterialCommunityIcons
              name="plus"
              size={16}
              color={colors.umber}
            />
            <Text style={styles.emptyText}>Plan a meal</Text>
          </TouchableOpacity>
        ) : (
          <>
            {entries.map((entry) => (
              <MealCard
                key={entry.id}
                entry={entry}
                onPress={() => onPressMeal(entry)}
                onLongPress={() => onLongPressMeal(entry)}
                onToggleCooked={() => onToggleCooked(entry)}
                onSwipeDelete={() => onRemoveMeal(entry)}
                setPagerEnabled={setPagerEnabled}
              />
            ))}
            <TouchableOpacity
              onPress={onAdd}
              activeOpacity={0.85}
              style={styles.addMore}
            >
              <MaterialCommunityIcons name="plus" size={14} color={colors.umber} />
              <Text style={styles.addMoreText}>Add another</Text>
            </TouchableOpacity>
          </>
        )}

        {macros && (
          <View style={styles.macroRow}>
            <Text style={styles.macroPrimary}>{Math.round(macros.calories)} kcal</Text>
            <Text style={styles.macroDot}>·</Text>
            <Text style={styles.macroSecondary}>
              {Math.round(macros.proteinG)}p / {Math.round(macros.carbsG)}c / {Math.round(macros.fatG)}f
            </Text>
          </View>
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  left: {
    width: 48,
    alignItems: 'flex-start',
    paddingTop: 2,
    position: 'relative',
  },
  dow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  dowToday: {
    color: colors.terra,
  },
  day: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.espresso,
    lineHeight: 34,
    marginTop: 2,
  },
  dayToday: {
    color: colors.terra,
  },
  muted: {
    opacity: 0.55,
  },
  right: {
    flex: 1,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderResting,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  addMoreText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.umber,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingTop: spacing.xs,
    paddingHorizontal: 4,
  },
  macroPrimary: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.espresso,
  },
  macroDot: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  macroSecondary: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
});
