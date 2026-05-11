import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import type { PlannedMeal } from '@/types';

interface Props {
  visible: boolean;
  entry: PlannedMeal | null;
  weekStart: string;             // Monday ISO of currently visible week
  onClose: () => void;
  onView: (entry: PlannedMeal) => void;
  onToggleCooked: (entry: PlannedMeal) => void;
  onMoveToDate: (entry: PlannedMeal, isoDate: string) => void;
  onRemove: (entry: PlannedMeal) => void;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

export function MealActionsSheet({
  visible,
  entry,
  weekStart,
  onClose,
  onView,
  onToggleCooked,
  onMoveToDate,
  onRemove,
}: Props) {
  const [showMove, setShowMove] = useState(false);

  const sheetHeight = Dimensions.get('window').height;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  useEffect(() => {
    if (visible) {
      setShowMove(false);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, backdropAnim, sheetAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: sheetHeight, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const days = useMemo(() => {
    const arr: Date[] = [];
    if (!weekStart) return arr;
    const start = parseIso(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  if (!entry) return null;

  const cooked = !!entry.cookedAt;
  const title = entry.recipe?.title ?? 'Recipe';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.handle} />

            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.subtitle}>{entry.mealType}</Text>

            {!showMove ? (
              <View style={styles.actions}>
                <ActionRow
                  icon="book-open-page-variant-outline"
                  label="View recipe"
                  onPress={() => {
                    handleClose();
                    setTimeout(() => onView(entry), 120);
                  }}
                />
                <ActionRow
                  icon={cooked ? 'check-circle' : 'check-circle-outline'}
                  label={cooked ? 'Mark as not cooked' : 'Mark as cooked'}
                  iconColor={cooked ? colors.sage : colors.espresso}
                  onPress={() => {
                    onToggleCooked(entry);
                    handleClose();
                  }}
                />
                <ActionRow
                  icon="calendar-arrow-right"
                  label="Move to another day"
                  onPress={() => setShowMove(true)}
                />
                <ActionRow
                  icon="trash-can-outline"
                  label="Remove from plan"
                  destructive
                  onPress={() => {
                    onRemove(entry);
                    handleClose();
                  }}
                />
              </View>
            ) : (
              <View style={styles.moveSection}>
                <Text style={styles.moveHeader}>Move to</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayRow}
                >
                  {days.map((d) => {
                    const iso = toIso(d);
                    const isCurrent = iso === entry.plannedDate;
                    const dow = DOW[(d.getDay() + 6) % 7];
                    return (
                      <TouchableOpacity
                        key={iso}
                        disabled={isCurrent}
                        style={[styles.dayChip, isCurrent && styles.dayChipCurrent]}
                        activeOpacity={0.85}
                        onPress={() => {
                          onMoveToDate(entry, iso);
                          handleClose();
                        }}
                      >
                        <Text style={[styles.dayChipDow, isCurrent && styles.muted]}>
                          {dow}
                        </Text>
                        <Text style={[styles.dayChipNum, isCurrent && styles.muted]}>
                          {d.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setShowMove(false)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="chevron-left" size={16} color={colors.espresso} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
  iconColor,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  iconColor?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.actionRow}>
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color={destructive ? colors.rust : iconColor ?? colors.espresso}
      />
      <Text style={[styles.actionLabel, destructive && styles.destructive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(44,34,24,0.35)' },
  sheetWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
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
  title: { ...typeScale.h2, color: colors.espresso },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  actions: { gap: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
  },
  actionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  destructive: { color: colors.rust },

  moveSection: { gap: spacing.md },
  moveHeader: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  dayRow: { gap: spacing.sm, paddingVertical: 4 },
  dayChip: {
    minWidth: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    alignItems: 'center',
    gap: 2,
  },
  dayChipCurrent: { opacity: 0.5 },
  muted: { opacity: 0.6 },
  dayChipDow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  dayChipNum: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.espresso,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },
});
