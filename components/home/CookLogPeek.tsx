import { useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import { useCookLogStore } from '@/store/cookLog';
import { Sticker } from '@/components/ui/Sticker';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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

export function CookLogPeek() {
  const router = useRouter();
  const fetchMonth = useCookLogStore((s) => s.fetchMonth);
  const logsByMonth = useCookLogStore((s) => s.logsByMonth);

  const month = currentMonthKey();
  const logs = useMemo(() => logsByMonth[month] ?? [], [logsByMonth, month]);

  useEffect(() => {
    fetchMonth(month);
  }, [month, fetchMonth]);

  const recent = logs.slice(0, 4);
  const monthLabel = MONTH_NAMES[new Date().getMonth()];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push('/(tabs)/cook')}
    >
      <View style={styles.text}>
        <Text style={styles.overline}>cook log · {monthLabel.toLowerCase()}</Text>
        <Text style={styles.title}>
          {logs.length === 0
            ? 'Snap your first cook'
            : `${logs.length} ${logs.length === 1 ? 'meal' : 'meals'} so far`}
        </Text>
        <Text style={styles.sub}>
          {logs.length === 0
            ? 'Turn your photos into stickers.'
            : 'Tap to see your sticker calendar.'}
        </Text>
      </View>
      {recent.length > 0 ? (
        <View style={styles.stickers}>
          {recent.map((log, i) => (
            <View
              key={log.id}
              style={[styles.stickerSlot, { transform: [{ rotate: `${(i - 1.5) * 4}deg` }] }]}
            >
              <Sticker uri={log.stickerUrl} style={styles.stickerImage} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="sticker-emoji"
            size={22}
            color={colors.terra}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  overline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
  },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickerSlot: {
    width: 30,
    height: 30,
    marginLeft: -8,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
});
