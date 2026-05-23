import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { StickerWall } from '@/components/cook-log/StickerWall';
import { recapService, type RecapPeriod, type RecapScope } from '@/services/recap';

const CARD_WIDTH = Dimensions.get('window').width - spacing.xl * 2;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.1);

const SCOPES: Array<{ id: RecapScope; label: string }> = [
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'all', label: 'All' },
];

function monthShort(label: string): { month: string; year: string } {
  // "May 2026" -> { month: "May", year: "2026" }
  const parts = label.split(' ');
  if (parts.length === 2) return { month: parts[0], year: parts[1] };
  return { month: label, year: '' };
}

export default function RecapListScreen() {
  const router = useRouter();
  const [scope, setScope] = useState<RecapScope>('month');
  const [periods, setPeriods] = useState<RecapPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    recapService
      .listPeriods(scope)
      .then((data) => {
        if (!cancelled) setPeriods(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your recaps.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ width: 36 }} />
        <Text style={styles.title}>Recap</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.closeBtn}
        >
          <MaterialCommunityIcons name="close" size={20} color={colors.espresso} />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentedWrap}>
        <View style={styles.segmented}>
          {SCOPES.map((s) => {
            const active = s.id === scope;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setScope(s.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.terra} />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : periods.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={32}
              color={colors.umber}
            />
            <Text style={styles.emptyTitle}>Nothing to recap yet</Text>
            <Text style={styles.emptySub}>
              Log a few cooks and they&rsquo;ll show up here, grouped by{' '}
              {scope === 'all' ? 'all time' : scope}.
            </Text>
          </View>
        ) : (
          periods.map((p) => {
            const { month, year } = monthShort(p.label);
            const stickerItems = p.stickerUrls.map((uri, i) => ({
              id: `${p.scope}-${p.key}-${i}`,
              uri,
            }));
            return (
              <TouchableOpacity
                key={`${p.scope}-${p.key}`}
                style={styles.card}
                activeOpacity={0.92}
                onPress={() =>
                  router.push(
                    `/recap/detail?scope=${p.scope}&key=${encodeURIComponent(
                      p.key,
                    )}` as any,
                  )
                }
              >
                {stickerItems.length > 0 ? (
                  <View style={styles.cardImage} pointerEvents="none">
                    <StickerWall items={stickerItems} height={CARD_HEIGHT} />
                  </View>
                ) : p.coverImageUrl ? (
                  <Image
                    source={{ uri: p.coverImageUrl }}
                    style={styles.cardImage}
                  />
                ) : (
                  <View style={[styles.cardImage, styles.cardImageFallback]}>
                    <MaterialCommunityIcons
                      name="silverware-fork-knife"
                      size={36}
                      color={colors.umber}
                    />
                  </View>
                )}

                <View style={styles.cardOverlay}>
                  <View style={styles.cardLabel}>
                    <Text style={styles.cardMonth}>{month}</Text>
                    {year ? <Text style={styles.cardYear}>{year}</Text> : null}
                  </View>
                  <View style={styles.cardChevron}>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textOnDark}
                    />
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>
                    {p.count} {p.count === 1 ? 'cook' : 'cooks'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.espresso,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    alignItems: 'center',
    justifyContent: 'center',
  },

  segmentedWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    borderRadius: radius.pill,
    padding: 4,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.espresso,
  },
  segmentLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  segmentLabelActive: {
    color: colors.textOnDark,
  },

  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl3,
    gap: spacing.lg,
  },
  center: { alignItems: 'center', paddingVertical: spacing.xl2 },
  error: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.rust,
    textAlign: 'center',
    paddingVertical: spacing.xl2,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl3,
  },
  emptyTitle: {
    ...typeScale.h2,
    fontSize: 18,
    color: colors.espresso,
    marginTop: spacing.sm,
  },
  emptySub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 19,
  },

  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.espresso,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,34,24,0.28)',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: { flexShrink: 1 },
  cardMonth: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.textOnDark,
    lineHeight: 44,
  },
  cardYear: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.textOnDark,
    opacity: 0.85,
    marginTop: 2,
  },
  cardChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.lg,
  },
  cardFooterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textOnDark,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
