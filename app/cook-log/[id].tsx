import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useCookLogStore } from '@/store/cookLog';
import { useRecipesStore } from '@/store/recipes';
import { Sticker } from '@/components/ui/Sticker';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CookLogDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const logsByMonth = useCookLogStore((s) => s.logsByMonth);
  const removeLog = useCookLogStore((s) => s.remove);
  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);
  const [busy, setBusy] = useState(false);

  const log = useMemo(() => {
    for (const monthLogs of Object.values(logsByMonth)) {
      const found = monthLogs.find((l) => l.id === id);
      if (found) return found;
    }
    return null;
  }, [logsByMonth, id]);

  useEffect(() => {
    if (recipes.length === 0) fetchRecipes();
  }, [recipes.length, fetchRecipes]);

  const recipe = useMemo(
    () => (log?.recipeId ? recipes.find((r) => r.id === log.recipeId) : null),
    [log, recipes],
  );

  if (!log) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={colors.espresso}
            />
          </TouchableOpacity>
          <View style={{ width: 22 }} />
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>This sticker is no longer here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    try {
      const message = log.caption
        ? `${log.caption} — cooked ${formatDate(log.cookedDate)}`
        : `Cooked ${formatDate(log.cookedDate)}`;
      await Share.share({
        message,
        url: log.stickerUrl,
      });
    } catch {
      // Share dismissals throw on some platforms; safe to ignore.
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete sticker?', 'This will permanently remove this entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            await removeLog(log.id);
            router.back();
          } catch {
            setBusy(false);
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={colors.espresso}
          />
        </TouchableOpacity>
        <Text style={styles.headerOverline}>cook log</Text>
        <TouchableOpacity onPress={handleShare} hitSlop={12}>
          <MaterialCommunityIcons
            name="share-variant-outline"
            size={22}
            color={colors.espresso}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.stage}>
        <Sticker uri={log.stickerUrl} style={styles.sticker} borderScale={1.05} />
      </View>

      <View style={styles.meta}>
        <Text style={styles.dateLabel}>{formatDate(log.cookedDate)}</Text>
        {log.caption ? (
          <Text style={styles.caption}>&ldquo;{log.caption}&rdquo;</Text>
        ) : null}

        {recipe ? (
          <TouchableOpacity
            style={styles.recipeRow}
            activeOpacity={0.85}
            onPress={() => router.push(`/recipe/${recipe.id}`)}
          >
            <View style={styles.recipeIcon}>
              <MaterialCommunityIcons
                name="book-open-variant"
                size={18}
                color={colors.terra}
              />
            </View>
            <View style={styles.recipeMeta}>
              <Text style={styles.recipeOverline}>From recipe</Text>
              <Text style={styles.recipeTitle} numberOfLines={1}>
                {recipe.title}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.umber}
            />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.7}
          disabled={busy}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={16}
            color={colors.rust}
          />
          <Text style={styles.deleteText}>Delete sticker</Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerOverline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.umber,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
  },

  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sticker: {
    width: '100%',
    height: '100%',
  },

  meta: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl3,
    gap: spacing.md,
  },
  dateLabel: {
    ...typeScale.h2,
    fontSize: 22,
    color: colors.espresso,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.md,
  },
  recipeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeMeta: {
    flex: 1,
    gap: 2,
  },
  recipeOverline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  recipeTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.espresso,
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  deleteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.rust,
    letterSpacing: 0.3,
  },
});
