import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { plannerService } from '@/services/planner';
import type { PlannedMeal } from '@/types';

type MealType = PlannedMeal['mealType'];

const MEAL_TYPES: Array<{ id: MealType; label: string; icon: string }> = [
  { id: 'breakfast', label: 'Breakfast', icon: 'weather-sunny' },
  { id: 'lunch', label: 'Lunch', icon: 'white-balance-sunny' },
  { id: 'dinner', label: 'Dinner', icon: 'weather-night' },
  { id: 'snack', label: 'Snack', icon: 'cookie-outline' },
];

interface Props {
  visible: boolean;
  recipeId: string;
  recipeTitle: string;
  servings: number;
  onClose: () => void;
  onAdded?: (entry: PlannedMeal) => void;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultMealType(now: Date = new Date()): MealType {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AddToPlanSheet({
  visible,
  recipeId,
  recipeTitle,
  servings,
  onClose,
  onAdded,
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [today]);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set([toIsoDate(today)]),
  );
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const toggleDate = (iso: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const sheetHeight = Dimensions.get('window').height;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  useEffect(() => {
    if (visible) {
      setSelectedDates(new Set([toIsoDate(today)]));
      setMealType(defaultMealType());
      setConfirmation(null);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropAnim, sheetAnim, today]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: sheetHeight,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setBusy(false);
      onClose();
    });
  };

  const handleAdd = async () => {
    if (busy) return;
    const dates = Array.from(selectedDates).sort();
    if (dates.length === 0) return;
    setBusy(true);
    try {
      const entries = await Promise.all(
        dates.map((plannedDate) =>
          plannerService.addEntry({
            recipeId,
            plannedDate,
            mealType,
            servings,
          }),
        ),
      );
      entries.forEach((e) => onAdded?.(e));
      const meal = MEAL_TYPES.find((m) => m.id === mealType)?.label ?? '';
      const summary =
        dates.length === 1
          ? `Added to ${formatDayLabel(dates[0], today)} · ${meal}`
          : `Added to ${dates.length} days · ${meal}`;
      setConfirmation(summary);
      setTimeout(() => handleClose(), 900);
    } catch {
      setConfirmation('Could not add to plan');
      setTimeout(() => setBusy(false), 200);
    }
  };

  const servingLabel = servings === 1 ? 'serving' : 'servings';
  const selectedCount = selectedDates.size;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <View style={styles.handle} />

            <Text style={styles.title}>Add to plan</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {servings} {servingLabel} of {recipeTitle}
            </Text>

            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>When</Text>
              <Text style={styles.fieldHint}>
                {selectedCount > 1
                  ? `${selectedCount} days selected`
                  : 'Tap to select multiple days'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
              style={styles.dayScroll}
            >
              {days.map((d) => {
                const iso = toIsoDate(d);
                const isSelected = selectedDates.has(iso);
                const isToday = iso === toIsoDate(today);
                return (
                  <TouchableOpacity
                    key={iso}
                    activeOpacity={0.85}
                    onPress={() => toggleDate(iso)}
                    style={[
                      styles.dayChip,
                      isSelected && styles.dayChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipDow,
                        isSelected && styles.dayChipTextOn,
                      ]}
                    >
                      {isToday ? 'Today' : DAY_NAMES[d.getDay()]}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipNum,
                        isSelected && styles.dayChipTextOn,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>Meal</Text>
            <View style={styles.mealRow}>
              {MEAL_TYPES.map((m) => {
                const isSelected = m.id === mealType;
                return (
                  <TouchableOpacity
                    key={m.id}
                    activeOpacity={0.85}
                    onPress={() => setMealType(m.id)}
                    style={[
                      styles.mealChip,
                      isSelected && styles.mealChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mealChipText,
                        isSelected && styles.mealChipTextOn,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {confirmation && (
              <View style={styles.toast}>
                <View style={styles.toastDot} />
                <Text style={styles.toastText}>{confirmation}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.85}
                onPress={handleClose}
                disabled={busy}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  (busy || selectedCount === 0) && styles.addBtnDisabled,
                ]}
                activeOpacity={0.85}
                onPress={handleAdd}
                disabled={busy || selectedCount === 0}
              >
                <MaterialCommunityIcons
                  name="calendar-plus"
                  size={16}
                  color={colors.textOnDark}
                />
                <Text style={styles.addText}>
                  {busy
                    ? 'Adding…'
                    : selectedCount > 1
                    ? `Add to ${selectedCount} days`
                    : `Add ${servings} ${servingLabel}`}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function formatDayLabel(iso: string, today: Date): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayIso = toIsoDate(today);
  if (iso === todayIso) return 'today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (iso === toIsoDate(tomorrow)) return 'tomorrow';
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()}`;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  sheetWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,34,24,0.35)',
  },
  sheet: {
    backgroundColor: colors.oat,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl3 : spacing.xl2,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderEmphasis,
    marginBottom: spacing.lg,
  },
  title: {
    ...typeScale.h2,
    color: colors.espresso,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    marginBottom: spacing.lg,
  },

  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fieldHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.umber,
    textTransform: 'none',
    letterSpacing: 0,
  },

  dayScroll: { marginBottom: spacing.lg },
  dayRow: { gap: spacing.sm, paddingVertical: 2 },
  dayChip: {
    minWidth: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.inner,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayChipSelected: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso,
  },
  dayChipDow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  dayChipNum: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
  },
  dayChipTextOn: {
    color: colors.textOnDark,
  },

  mealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  mealChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  mealChipSelected: {
    backgroundColor: colors.terra,
    borderColor: colors.terra,
  },
  mealChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },
  mealChipTextOn: {
    color: colors.textOnDark,
  },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.espresso,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.inner,
    marginBottom: spacing.md,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sage,
  },
  toastText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.oat,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderEmphasis,
  },
  cancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  addBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.terra,
  },
  addBtnDisabled: { opacity: 0.5 },
  addText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textOnDark,
  },
});
