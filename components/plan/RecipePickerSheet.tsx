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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import type { PlannedMeal, Recipe } from '@/types';
import { useRecipesStore } from '@/store/recipes';
import { useCollectionsStore } from '@/store/collections';
import { usePlanStore } from '@/store/plan';

type MealType = PlannedMeal['mealType'];

const MEAL_TYPES: Array<{ id: MealType; label: string }> = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

interface Props {
  visible: boolean;
  targetDate: string;          // YYYY-MM-DD
  defaultMealType?: MealType;
  onClose: () => void;
  onAdded?: () => void;
}

function defaultMealForHour(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function RecipePickerSheet({
  visible,
  targetDate,
  defaultMealType,
  onClose,
  onAdded,
}: Props) {
  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);
  const collections = useCollectionsStore((s) => s.collections);
  const fetchCollections = useCollectionsStore((s) => s.fetch);
  const addEntry = usePlanStore((s) => s.addEntry);

  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? defaultMealForHour());
  const [query, setQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sheetHeight = Dimensions.get('window').height;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  useEffect(() => {
    if (visible) {
      setMealType(defaultMealType ?? defaultMealForHour());
      setQuery('');
      setCollectionFilter(null);
      setBusyId(null);
      fetchRecipes().catch(() => {});
      fetchCollections().catch(() => {});
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, backdropAnim, sheetAnim, fetchRecipes, fetchCollections, defaultMealType]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: sheetHeight, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const filtered = useMemo(() => {
    let list = recipes;
    if (collectionFilter) {
      const coll = collections.find((c) => c.id === collectionFilter);
      const ids = new Set(coll?.recipeIds ?? []);
      list = list.filter((r) => ids.has(r.id));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.title.toLowerCase().includes(q));
    return list;
  }, [recipes, query, collectionFilter, collections]);

  const handlePick = async (recipe: Recipe) => {
    if (busyId) return;
    setBusyId(recipe.id);
    try {
      await addEntry({
        recipeId: recipe.id,
        plannedDate: targetDate,
        mealType,
        servings: recipe.servings ?? 2,
      });
      onAdded?.();
      handleClose();
    } catch {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Add to plan</Text>
            <Text style={styles.subtitle}>{formatDateLabel(targetDate)}</Text>

            <Text style={styles.fieldLabel}>Meal</Text>
            <View style={styles.mealRow}>
              {MEAL_TYPES.map((m) => {
                const sel = m.id === mealType;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setMealType(m.id)}
                    style={[styles.mealChip, sel && styles.mealChipOn]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.mealChipText, sel && styles.mealChipTextOn]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Recipe</Text>

            {collections.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bookRow}
                style={styles.bookScroll}
              >
                <TouchableOpacity
                  onPress={() => setCollectionFilter(null)}
                  activeOpacity={0.85}
                  style={[
                    styles.bookChip,
                    collectionFilter === null && styles.bookChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.bookChipText,
                      collectionFilter === null && styles.bookChipTextOn,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {collections.map((c) => {
                  const sel = collectionFilter === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setCollectionFilter(c.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.bookChip,
                        { backgroundColor: sel ? c.coverColor : colors.cardBg },
                        sel && { borderColor: c.spineColor },
                      ]}
                    >
                      <View
                        style={[
                          styles.bookSpine,
                          { backgroundColor: c.spineColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.bookChipText,
                          sel && { color: c.inkColor },
                        ]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.searchWrap}>
              <MaterialCommunityIcons name="magnify" size={16} color={colors.umber} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search saved recipes"
                placeholderTextColor={colors.umber}
                style={styles.searchInput}
              />
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={{ paddingBottom: spacing.xl2 }}
              showsVerticalScrollIndicator={false}
            >
              {filtered.length === 0 ? (
                <Text style={styles.emptyText}>
                  {recipes.length === 0
                    ? 'No saved recipes yet. Import or save one to plan it.'
                    : collectionFilter
                    ? 'No recipes in this cookbook yet'
                    : 'No matches'}
                </Text>
              ) : (
                filtered.map((r) => {
                  const busy = busyId === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.recipeRow}
                      activeOpacity={0.85}
                      onPress={() => handlePick(r)}
                      disabled={busy}
                    >
                      <View style={styles.recipeBody}>
                        <Text style={styles.recipeTitle} numberOfLines={1}>{r.title}</Text>
                        <Text style={styles.recipeMeta} numberOfLines={1}>
                          {[r.cuisine, r.durationMinutes ? `${r.durationMinutes} min` : null]
                            .filter(Boolean)
                            .join(' · ') || `${r.servings} servings`}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name={busy ? 'progress-clock' : 'plus-circle-outline'}
                        size={22}
                        color={busy ? colors.umber : colors.terra}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
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
    maxHeight: '85%',
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
  mealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  mealChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  mealChipOn: { backgroundColor: colors.terra, borderColor: colors.terra },
  mealChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },
  mealChipTextOn: { color: colors.textOnDark },

  bookScroll: {
    marginBottom: spacing.md,
  },
  bookRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  bookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    maxWidth: 200,
    overflow: 'hidden',
    gap: 8,
  },
  bookChipOn: {
    backgroundColor: colors.linen,
    borderColor: colors.borderEmphasis,
  },
  bookSpine: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  bookChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },
  bookChipTextOn: {
    color: colors.espresso,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.espresso,
    padding: 0,
  },

  list: {
    maxHeight: 360,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  recipeBody: { flex: 1 },
  recipeTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.espresso,
  },
  recipeMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    textAlign: 'center',
    paddingVertical: spacing.xl2,
  },
});
