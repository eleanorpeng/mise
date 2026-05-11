import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import { addWeeks, getMondayIso } from '@/store/plan';

interface Props {
  weekStart: string;        // Monday ISO of the visible week
  onPrev: () => void;
  onNext: () => void;
  onJumpToToday: () => void;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(weekStart: string): string {
  const start = parseIso(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const right = sameMonth
    ? `${end.getDate()}`
    : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${left} – ${right}`;
}

function relativeLabel(weekStart: string): string {
  const today = getMondayIso();
  if (weekStart === today) return 'This week';
  if (weekStart === addWeeks(today, 1)) return 'Next week';
  if (weekStart === addWeeks(today, -1)) return 'Last week';
  // Fallback: month name + week-of-year-ish
  return 'Week of';
}

export function WeekHeader({ weekStart, onPrev, onNext, onJumpToToday }: Props) {
  const today = getMondayIso();
  const isCurrent = weekStart === today;
  const label = relativeLabel(weekStart);
  const range = formatDateRange(weekStart);

  return (
    <LinearGradient
      colors={[colors.blush, colors.oat]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.row}>
        <TouchableOpacity onPress={onPrev} style={styles.navBtn} activeOpacity={0.7} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={colors.espresso} />
        </TouchableOpacity>

        <View style={styles.center}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.range}>{range}</Text>
        </View>

        <TouchableOpacity onPress={onNext} style={styles.navBtn} activeOpacity={0.7} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.espresso} />
        </TouchableOpacity>
      </View>

      {!isCurrent && (
        <TouchableOpacity onPress={onJumpToToday} style={styles.todayBtn} activeOpacity={0.85}>
          <MaterialCommunityIcons name="calendar-today" size={13} color={colors.terra} />
          <Text style={styles.todayText}>Back to this week</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 2,
  },
  range: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.espresso,
  },
  todayBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  todayText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.terra,
  },
});
