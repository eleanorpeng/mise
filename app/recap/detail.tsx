import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { StickerWall } from '@/components/cook-log/StickerWall';
import {
  recapService,
  type RecapDetail,
  type RecapScope,
} from '@/services/recap';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 6;
const GRID_COLS = 3;
const TILE_SIZE = Math.floor(
  (SCREEN_WIDTH - spacing.xl * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS,
);

function splitLabel(label: string): { primary: string; secondary: string } {
  const parts = label.split(' ');
  if (parts.length >= 2) {
    return { primary: parts[0], secondary: parts.slice(1).join(' ') };
  }
  return { primary: label, secondary: '' };
}

function buildShareText(detail: RecapDetail): string {
  const { stats, label } = detail;
  const lines = [`My Mise recap — ${label}`, ''];
  lines.push(
    `${stats.recipesCooked} ${stats.recipesCooked === 1 ? 'cook' : 'cooks'} logged`,
  );
  if (stats.cuisines.length) {
    lines.push(
      `Cuisines: ${stats.cuisines.slice(0, 5).join(', ')}${stats.cuisines.length > 5 ? '…' : ''}`,
    );
  }
  if (stats.techniques.length) {
    lines.push(
      `Techniques: ${stats.techniques.slice(0, 5).join(', ')}${stats.techniques.length > 5 ? '…' : ''}`,
    );
  }
  return lines.join('\n');
}

export default function RecapDetailScreen() {
  const router = useRouter();
  const { scope, key } = useLocalSearchParams<{ scope: RecapScope; key: string }>();

  const [detail, setDetail] = useState<RecapDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scope || !key) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    recapService
      .getDetail(scope, key)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this recap.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, key]);

  const handleShare = async () => {
    if (!detail) return;
    try {
      await Share.share({
        message: buildShareText(detail),
      });
    } catch {
      // user cancelled — ignore
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.terra} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Recap not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { primary, secondary } = splitLabel(detail.label);
  const stats = detail.stats;
  const stickerItems = detail.photos
    .filter((p) => p.stickerUrl)
    .map((p) => ({ id: p.id, uri: p.stickerUrl as string }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={colors.espresso}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShare}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name="share-variant"
            size={18}
            color={colors.espresso}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {stickerItems.length > 0 ? (
            <View style={styles.heroStickers} pointerEvents="none">
              <StickerWall items={stickerItems} height={280} />
            </View>
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}>
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={36}
                color={colors.umber}
              />
            </View>
          )}
          <View style={styles.heroLabel}>
            <Text style={styles.heroPrimary}>{primary}</Text>
            {secondary ? <Text style={styles.heroSecondary}>{secondary}</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBlock
            value={String(stats.recipesCooked)}
            label={stats.recipesCooked === 1 ? 'cook' : 'cooks'}
          />
          <View style={styles.statDivider} />
          <StatBlock
            value={String(stats.cuisines.length)}
            label={stats.cuisines.length === 1 ? 'cuisine' : 'cuisines'}
          />
          <View style={styles.statDivider} />
          <StatBlock
            value={String(stats.techniques.length)}
            label={stats.techniques.length === 1 ? 'technique' : 'techniques'}
          />
        </View>

        {stats.cuisines.length > 0 && (
          <Section title="Cuisines tried">
            <View style={styles.chipsWrap}>
              {stats.cuisines.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {stats.techniques.length > 0 && (
          <Section title="Techniques learned">
            <View style={styles.chipsWrap}>
              {stats.techniques.map((t) => (
                <View key={t} style={[styles.chip, styles.chipAccent]}>
                  <Text style={[styles.chipText, styles.chipTextAccent]}>{t}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {detail.photos.length > 0 && (
          <Section title="Cooks">
            <View style={styles.grid}>
              {detail.photos.map((p) => (
                <View
                  key={p.id}
                  style={[styles.tile, { width: TILE_SIZE, height: TILE_SIZE }]}
                >
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={styles.tileImage} />
                  ) : (
                    <View style={[styles.tileImage, styles.tileFallback]}>
                      <MaterialCommunityIcons
                        name="image-off-outline"
                        size={18}
                        color={colors.umber}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.rust,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingBottom: spacing.xl3,
    gap: spacing.xl,
  },

  hero: {
    marginHorizontal: spacing.xl,
    height: 280,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.espresso,
  },
  heroImage: { width: '100%', height: '100%' },
  heroStickers: { ...StyleSheet.absoluteFillObject },
  heroFallback: {
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.lg,
    right: spacing.lg,
  },
  heroPrimary: {
    fontFamily: fonts.display,
    fontSize: 52,
    color: colors.textOnDark,
    lineHeight: 56,
  },
  heroSecondary: {
    fontFamily: fonts.bodyRegular,
    fontSize: 18,
    color: colors.textOnDark,
    opacity: 0.9,
    marginTop: 4,
  },

  statsRow: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.terra,
    lineHeight: 30,
  },
  statLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.umber,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 0.5,
    height: 32,
    backgroundColor: colors.borderResting,
  },

  section: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 2,
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.espresso,
  },
  chipAccent: {
    backgroundColor: colors.blush,
    borderColor: 'transparent',
  },
  chipTextAccent: {
    color: colors.brick,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    borderRadius: radius.inner,
    overflow: 'hidden',
    backgroundColor: colors.cardBg,
  },
  tileImage: { width: '100%', height: '100%' },
  tileFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.linen,
  },
});
