import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors, fonts, radius, spacing } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { profileService } from '@/services/profile';
import type { ProfileInsights } from '@/types';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function StatsScreen() {
  const [data, setData] = useState<ProfileInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const insights = await profileService.insights();
        if (!cancelled) setData(insights);
      } catch {
        // empty state will render
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Cooking stats" />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.terra} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero summary */}
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>All time</Text>
            <Text style={styles.heroNumber}>{data?.totalCooked ?? 0}</Text>
            <Text style={styles.heroLabel}>meals cooked</Text>
            <View style={styles.heroBlobOne} />
            <View style={styles.heroBlobTwo} />
          </View>

          {/* Quick metrics grid */}
          <View style={styles.metricsGrid}>
            <Metric label="Recipes saved" value={data?.totalRecipes ?? 0} />
            <Metric label="This month" value={data?.cookedThisMonth ?? 0} />
            <Metric label="This year" value={data?.cookedThisYear ?? 0} />
            <Metric
              label="Day streak"
              value={data?.currentStreakDays ?? 0}
              accent
            />
          </View>

          {/* Activity */}
          <SectionLabel>Last 6 months</SectionLabel>
          <View style={styles.card}>
            <ActivityChart data={data?.monthlyActivity ?? []} />
          </View>

          {/* Cuisines */}
          <SectionLabel>Top cuisines</SectionLabel>
          <View style={styles.card}>
            {data && data.topCuisines.length > 0 ? (
              data.topCuisines.map((c, i) => (
                <CuisineRow
                  key={c.cuisine}
                  cuisine={c.cuisine}
                  count={c.count}
                  max={data.topCuisines[0]?.count ?? 1}
                  isLast={i === data.topCuisines.length - 1}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                Save recipes with cuisines to see your top picks here.
              </Text>
            )}
          </View>

          {/* Techniques */}
          <SectionLabel>Techniques learned</SectionLabel>
          <View style={[styles.card, styles.techniquesCard]}>
            <Text style={styles.techniquesNumber}>
              {data?.techniquesLearned ?? 0}
            </Text>
            <Text style={styles.techniquesSub}>
              distinct techniques across your saved recipes
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View style={[styles.metricTile, accent && styles.metricTileAccent]}>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, accent && styles.metricLabelAccent]}>
        {label}
      </Text>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function ActivityChart({ data }: { data: ProfileInsights['monthlyActivity'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={styles.chartRow}>
      {data.map((d) => {
        const ratio = d.count / max;
        const heightPct = Math.max(0.05, ratio);
        const monthIdx = parseInt(d.month.slice(5, 7), 10) - 1;
        return (
          <View key={d.month} style={styles.chartCol}>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBarFill,
                  { height: `${heightPct * 100}%` },
                  d.count === 0 && styles.chartBarEmpty,
                ]}
              />
            </View>
            <Text style={styles.chartCount}>{d.count}</Text>
            <Text style={styles.chartMonth}>{MONTH_SHORT[monthIdx]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CuisineRow({
  cuisine,
  count,
  max,
  isLast,
}: {
  cuisine: string;
  count: number;
  max: number;
  isLast: boolean;
}) {
  const ratio = count / max;
  return (
    <View style={[styles.cuisineRow, !isLast && styles.cuisineRowBorder]}>
      <View style={styles.cuisineHeader}>
        <Text style={styles.cuisineName}>{cuisine}</Text>
        <Text style={styles.cuisineCount}>{count}</Text>
      </View>
      <View style={styles.cuisineTrack}>
        <View
          style={[styles.cuisineFill, { width: `${Math.max(6, ratio * 100)}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl4,
    gap: spacing.lg,
  },

  // Hero
  hero: {
    backgroundColor: colors.espresso,
    borderRadius: radius.hero,
    padding: spacing.xl,
    minHeight: 160,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    gap: 2,
  },
  heroEyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.butter,
  },
  heroNumber: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 70,
    color: colors.textOnDark,
  },
  heroLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: 'rgba(250,232,218,0.7)',
  },
  heroBlobOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.terra,
    opacity: 0.5,
    right: -50,
    top: -60,
  },
  heroBlobTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.ember,
    opacity: 0.35,
    right: 30,
    top: -30,
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.lg,
    gap: 2,
  },
  metricTileAccent: {
    backgroundColor: colors.blush,
    borderColor: 'transparent',
  },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.espresso,
  },
  metricValueAccent: {
    color: colors.brick,
  },
  metricLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  metricLabelAccent: {
    color: colors.brick,
  },

  // Section label
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  // Card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.lg,
  },

  // Chart
  chartRow: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartBarTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: colors.linen,
    borderRadius: radius.tag,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: colors.terra,
    borderRadius: radius.tag,
  },
  chartBarEmpty: {
    backgroundColor: colors.sand,
  },
  chartCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.espresso,
  },
  chartMonth: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.umber,
  },

  // Cuisine rows
  cuisineRow: {
    paddingVertical: spacing.sm,
    gap: 6,
  },
  cuisineRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderResting,
  },
  cuisineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cuisineName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  cuisineCount: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },
  cuisineTrack: {
    height: 6,
    backgroundColor: colors.linen,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cuisineFill: {
    height: '100%',
    backgroundColor: colors.peach,
    borderRadius: 3,
  },

  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    lineHeight: 19,
  },

  // Techniques
  techniquesCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  techniquesNumber: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 60,
    color: colors.espresso,
  },
  techniquesSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    textAlign: 'center',
  },
});
