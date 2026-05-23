import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Chip } from '@/components/ui/Chip';
import { AddToCollectionSheet } from '@/components/recipe/AddToCollectionSheet';
import { AddToPlanSheet } from '@/components/recipe/AddToPlanSheet';
import { useRecipesStore } from '@/store/recipes';
import { useCollectionsStore } from '@/store/collections';
import { usePlanStore } from '@/store/plan';
import { inferGroceryCategory } from '@/lib/groceryCategory';
import { recipesService } from '@/services/recipes';
import type { Recipe, RecipeStep } from '@/types';

function formatMinutes(total?: number): string | null {
  if (!total) return null;
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const FRACTION_GLYPHS: Array<[number, string]> = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

function formatQuantity(q: number | null): string {
  if (q == null) return '';
  if (q === 0) return '0';

  const sign = q < 0 ? '-' : '';
  const abs = Math.abs(q);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  const tolerance = 0.03;

  if (frac < tolerance) return sign + String(whole);
  if (frac > 1 - tolerance) return sign + String(whole + 1);

  for (const [val, glyph] of FRACTION_GLYPHS) {
    if (Math.abs(frac - val) < tolerance) {
      return sign + (whole > 0 ? `${whole} ${glyph}` : glyph);
    }
  }

  return sign + abs.toFixed(2).replace(/\.?0+$/, '');
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 24;

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipeFromStore = useRecipesStore((s) =>
    s.recipes.find((r) => r.id === id),
  );

  const [recipe, setRecipe] = useState<Recipe | null>(recipeFromStore ?? null);
  const [loading, setLoading] = useState(!recipeFromStore);
  const [error, setError] = useState<string | null>(null);
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [servingsOverride, setServingsOverride] = useState<number | null>(null);
  const [macrosMode, setMacrosMode] = useState<'per-serving' | 'total'>(
    'per-serving',
  );

  const collections = useCollectionsStore((s) => s.collections);
  const collectionsForRecipe = collections.filter((c) =>
    id ? c.recipeIds.includes(id) : false,
  );

  const viewWeekStart = usePlanStore((s) => s.viewWeekStart);
  const addGroceryItem = usePlanStore((s) => s.addGroceryItem);
  const [addedIngredients, setAddedIngredients] = useState<Set<string>>(new Set());

  const handleAddIngredientToGrocery = (key: string, name: string, qty: number | null, unit?: string) => {
    if (addedIngredients.has(key)) return;
    setAddedIngredients((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    addGroceryItem({
      weekStart: viewWeekStart,
      ingredientName: name,
      totalQuantity: qty,
      unit: unit || undefined,
      category: inferGroceryCategory(name),
    }).catch(() => {
      setAddedIngredients((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  };

  const handleAddAllIngredientsToGrocery = () => {
    if (!recipe) return;
    recipe.ingredients.forEach((ing, i) => {
      const key = ing.id ?? String(i);
      if (addedIngredients.has(key)) return;
      const scaledQty = ing.quantity != null ? ing.quantity * scaleFactor : null;
      handleAddIngredientToGrocery(key, ing.name, scaledQty, ing.unit);
    });
  };

  useEffect(() => {
    if (!id) return;

    if (recipeFromStore) {
      setRecipe(recipeFromStore);
    } else {
      setLoading(true);
    }

    recipesService
      .get(id)
      .then((r) => setRecipe(r))
      .catch(() => setError('Could not load recipe'))
      .finally(() => setLoading(false));
  }, [id, recipeFromStore]);

  useEffect(() => {
    setServingsOverride(null);
  }, [id]);

  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.terra} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !recipe) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{error ?? 'Recipe not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = [
    formatMinutes(recipe.durationMinutes),
    recipe.difficulty,
    recipe.cuisine,
  ].filter(Boolean) as string[];

  const baseServings = recipe.servings > 0 ? recipe.servings : 1;
  const currentServings = servingsOverride ?? baseServings;
  const scaleFactor = currentServings / baseServings;
  const isScaled = currentServings !== baseServings;

  const decreaseServings = () => {
    setServingsOverride(Math.max(MIN_SERVINGS, currentServings - 1));
  };
  const increaseServings = () => {
    setServingsOverride(Math.min(MAX_SERVINGS, currentServings + 1));
  };
  const resetServings = () => setServingsOverride(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            hitSlop={12}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color={colors.espresso}
            />
          </TouchableOpacity>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={() => setPlanSheetOpen(true)}
              style={styles.iconBtn}
              hitSlop={12}
              accessibilityLabel="Add to plan"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="calendar-plus"
                size={18}
                color={colors.espresso}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSheetOpen(true)}
              style={styles.iconBtn}
              hitSlop={12}
              activeOpacity={0.85}
              accessibilityLabel={
                collectionsForRecipe.length > 0
                  ? 'Saved to cookbook'
                  : 'Add to cookbook'
              }
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={
                  collectionsForRecipe.length > 0
                    ? 'bookmark'
                    : 'bookmark-outline'
                }
                size={18}
                color={colors.espresso}
              />
            </TouchableOpacity>
          </View>
        </View>

        {recipe.coverImageUrl ? (
          <Image source={{ uri: recipe.coverImageUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={32}
              color={colors.umber}
            />
          </View>
        )}

        <View style={styles.headerBlock}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}
          {meta.length > 0 && (
            <View style={styles.metaRow}>
              {meta.map((m, i) => (
                <Chip key={i} label={m} variant="neutral" />
              ))}
            </View>
          )}

          {collectionsForRecipe.length > 0 && (
            <View style={styles.collectionsRow}>
              <Text style={styles.collectionsLabel}>Saved in</Text>
              <View style={styles.collectionsChips}>
                {collectionsForRecipe.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => router.push(`/collection/${c.id}`)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.collectionChip,
                        { backgroundColor: c.coverColor },
                      ]}
                    >
                      <View
                        style={[
                          styles.collectionChipSpine,
                          { backgroundColor: c.spineColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.collectionChipLabel,
                          { color: c.inkColor },
                        ]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {recipe.macros && (
          <View style={styles.macrosCard}>
            <View style={styles.macrosHeader}>
              <Text style={styles.sectionLabel}>
                {macrosMode === 'per-serving' ? 'Per serving' : 'Total'}
                {macrosMode === 'total' && currentServings > 1
                  ? ` · ${currentServings}`
                  : ''}
              </Text>
              <View style={styles.toggle}>
                <ToggleOption
                  label="Per serving"
                  active={macrosMode === 'per-serving'}
                  onPress={() => setMacrosMode('per-serving')}
                />
                <ToggleOption
                  label="Total"
                  active={macrosMode === 'total'}
                  onPress={() => setMacrosMode('total')}
                />
              </View>
            </View>
            <View style={styles.macrosRow}>
              <MacroCell
                label="Calories"
                value={Math.round(
                  recipe.macros.calories *
                    (macrosMode === 'total' ? currentServings : 1),
                )}
              />
              <MacroCell
                label="Protein"
                value={`${Math.round(
                  recipe.macros.proteinG *
                    (macrosMode === 'total' ? currentServings : 1),
                )}g`}
              />
              <MacroCell
                label="Carbs"
                value={`${Math.round(
                  recipe.macros.carbsG *
                    (macrosMode === 'total' ? currentServings : 1),
                )}g`}
              />
              <MacroCell
                label="Fat"
                value={`${Math.round(
                  recipe.macros.fatG *
                    (macrosMode === 'total' ? currentServings : 1),
                )}g`}
              />
            </View>
          </View>
        )}

        {recipe.ingredients.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Ingredients</Text>
              <ServingsStepper
                servings={currentServings}
                onDecrease={decreaseServings}
                onIncrease={increaseServings}
              />
            </View>
            {isScaled && (
              <TouchableOpacity
                onPress={resetServings}
                style={styles.scaledNote}
                hitSlop={6}
                activeOpacity={0.7}
              >
                <Text style={styles.scaledNoteText}>
                  Scaled from {baseServings} · Reset
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleAddAllIngredientsToGrocery}
              activeOpacity={0.85}
              style={styles.addAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Add all ingredients to grocery list"
            >
              <MaterialCommunityIcons
                name="basket-plus-outline"
                size={14}
                color={colors.terra}
              />
              <Text style={styles.addAllBtnText}>Add all to grocery</Text>
            </TouchableOpacity>
            <View style={styles.ingredientList}>
              {recipe.ingredients.map((ing, i) => {
                const key = ing.id ?? String(i);
                const scaledQty =
                  ing.quantity != null ? ing.quantity * scaleFactor : null;
                const qty = formatQuantity(scaledQty);
                const qtyUnit = [qty, ing.unit].filter(Boolean).join(' ');
                const added = addedIngredients.has(key);
                return (
                  <View key={key} style={styles.ingredientRow}>
                    <View style={styles.ingredientDot} />
                    <Text style={styles.ingredientText}>
                      {qtyUnit && <Text style={styles.ingredientQty}>{qtyUnit} </Text>}
                      {ing.name}
                      {ing.notes && (
                        <Text style={styles.ingredientNotes}>, {ing.notes}</Text>
                      )}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        handleAddIngredientToGrocery(key, ing.name, scaledQty, ing.unit)
                      }
                      disabled={added}
                      hitSlop={8}
                      activeOpacity={0.7}
                      style={[styles.ingredientAddBtn, added && styles.ingredientAddBtnDone]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        added ? `${ing.name} added to grocery` : `Add ${ing.name} to grocery`
                      }
                    >
                      <MaterialCommunityIcons
                        name={added ? 'check' : 'plus'}
                        size={14}
                        color={added ? colors.sage : colors.terra}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {recipe.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Method</Text>
            <View style={styles.stepList}>
              {recipe.steps.map((step, i) => (
                <StepBlock
                  key={step.id ?? i}
                  step={step}
                  index={i + 1}
                  expanded={expandedTechnique === (step.id ?? String(i))}
                  onToggleTechnique={() => {
                    LayoutAnimation.configureNext({
                      duration: 220,
                      create: {
                        type: LayoutAnimation.Types.easeInEaseOut,
                        property: LayoutAnimation.Properties.opacity,
                      },
                      update: { type: LayoutAnimation.Types.easeInEaseOut },
                      delete: {
                        type: LayoutAnimation.Types.easeInEaseOut,
                        property: LayoutAnimation.Properties.opacity,
                      },
                    });
                    setExpandedTechnique(
                      expandedTechnique === (step.id ?? String(i))
                        ? null
                        : step.id ?? String(i),
                    );
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {recipe.steps.length > 0 && (
        <View
          style={[
            styles.cookAlongBar,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
          ]}
        >
          <TouchableOpacity
            style={styles.cookAlongBtn}
            activeOpacity={0.85}
            onPress={() => router.push(`/cook-along/${id}` as any)}
          >
            <MaterialCommunityIcons
              name="microphone"
              size={18}
              color={colors.textOnDark}
            />
            <Text style={styles.cookAlongBtnText}>Cook along</Text>
          </TouchableOpacity>
        </View>
      )}

      {id && (
        <>
          <AddToCollectionSheet
            visible={sheetOpen}
            recipeId={id}
            onClose={() => setSheetOpen(false)}
          />
          <AddToPlanSheet
            visible={planSheetOpen}
            recipeId={id}
            recipeTitle={recipe.title}
            servings={currentServings}
            onClose={() => setPlanSheetOpen(false)}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function ToggleOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.toggleOption, active && styles.toggleOptionActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[styles.toggleText, active && styles.toggleTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MacroCell({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <View style={styles.macroCell}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function ServingsStepper({
  servings,
  onDecrease,
  onIncrease,
}: {
  servings: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const decreaseDisabled = servings <= MIN_SERVINGS;
  const increaseDisabled = servings >= MAX_SERVINGS;
  const servingLabel = servings === 1 ? 'serving' : 'servings';

  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        onPress={onDecrease}
        disabled={decreaseDisabled}
        style={[styles.stepperBtn, decreaseDisabled && styles.stepperBtnDisabled]}
        hitSlop={6}
        activeOpacity={0.7}
        accessibilityLabel="Decrease servings"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="minus"
          size={14}
          color={decreaseDisabled ? colors.sand : colors.espresso}
        />
      </TouchableOpacity>
      <View style={styles.stepperValueWrap}>
        <Text style={styles.stepperValue}>{servings}</Text>
        <Text style={styles.stepperLabel}>{servingLabel}</Text>
      </View>
      <TouchableOpacity
        onPress={onIncrease}
        disabled={increaseDisabled}
        style={[styles.stepperBtn, increaseDisabled && styles.stepperBtnDisabled]}
        hitSlop={6}
        activeOpacity={0.7}
        accessibilityLabel="Increase servings"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="plus"
          size={14}
          color={increaseDisabled ? colors.sand : colors.espresso}
        />
      </TouchableOpacity>
    </View>
  );
}

function StepBlock({
  step,
  index,
  expanded,
  onToggleTechnique,
}: {
  step: RecipeStep;
  index: number;
  expanded: boolean;
  onToggleTechnique: () => void;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>{String(index).padStart(2, '0')}</Text>
        {step.durationSeconds && (
          <Text style={styles.stepDuration}>
            {Math.round(step.durationSeconds / 60)} min
          </Text>
        )}
      </View>
      <Text style={styles.stepInstruction}>{step.instruction}</Text>
      {step.technique && (
        <View style={styles.techniqueWrap}>
          <TouchableOpacity
            onPress={onToggleTechnique}
            activeOpacity={0.85}
            style={[
              styles.techniqueCard,
              expanded && styles.techniqueCardExpanded,
            ]}
          >
            <Text style={styles.techniqueName}>{step.technique.name}</Text>
            {expanded && (
              <Text style={styles.techniqueExplanation}>
                {step.technique.explanation}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
  },
  content: { paddingBottom: 96 },

  cookAlongBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.oat,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderResting,
  },
  cookAlongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.terra,
    borderRadius: radius.pill,
    paddingVertical: 14,
  },
  cookAlongBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textOnDark,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.linen,
    marginTop: spacing.lg,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typeScale.h1,
    color: colors.espresso,
  },
  description: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.umber,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  collectionsRow: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  collectionsLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  collectionsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  collectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingRight: 12,
    overflow: 'hidden',
    maxWidth: 200,
  },
  collectionChipSpine: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 8,
  },
  collectionChipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    paddingVertical: 6,
  },

  macrosCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl2,
    padding: spacing.lg,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    gap: spacing.md,
  },
  macrosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.linen,
    borderRadius: radius.pill,
    padding: 2,
  },
  toggleOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  toggleOptionActive: {
    backgroundColor: colors.cardBg,
  },
  toggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.umber,
  },
  toggleTextActive: {
    color: colors.espresso,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCell: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.espresso,
  },
  macroLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.umber,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl3,
    gap: spacing.lg,
  },
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingHorizontal: spacing.xs,
    height: 34,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.5,
  },
  stepperValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: spacing.sm,
    minWidth: 64,
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  stepperLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  scaledNote: {
    alignSelf: 'flex-start',
    marginTop: -spacing.sm,
  },
  scaledNoteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.terra,
  },

  ingredientList: { gap: spacing.md },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  addAllBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212,82,28,0.08)',
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginTop: -spacing.sm,
  },
  addAllBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.terra,
  },
  ingredientAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  ingredientAddBtnDone: {
    backgroundColor: 'rgba(107,140,107,0.12)',
    borderColor: 'transparent',
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.terra,
    marginTop: 9,
  },
  ingredientText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.espresso,
  },
  ingredientQty: {
    fontFamily: fonts.bodyMedium,
  },
  ingredientNotes: {
    color: colors.umber,
  },

  stepList: { gap: spacing.xl2 },
  step: { gap: spacing.sm },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  stepNumber: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.terra,
  },
  stepDuration: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  stepInstruction: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.espresso,
  },
  techniqueWrap: {
    marginTop: spacing.xs,
  },
  techniqueCard: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blush,
    borderRadius: radius.input,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  techniqueCardExpanded: {
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  techniqueName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.brick,
  },
  techniqueExplanation: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.brick,
  },
});
