import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { recipesService } from '@/services/recipes';
import { useRecipesStore } from '@/store/recipes';

type Difficulty = 'easy' | 'medium' | 'hard';

interface IngredientRow {
  name: string;
  quantity: string;
  unit: string;
}

interface StepRow {
  instruction: string;
}

export default function NewRecipeScreen() {
  const router = useRouter();
  const addRecipe = useRecipesStore((s) => s.add);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [servings, setServings] = useState('2');
  const [duration, setDuration] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { name: '', quantity: '', unit: '' },
  ]);
  const [stepRows, setStepRows] = useState<StepRow[]>([{ instruction: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ingredient row helpers
  const updateIngredient = (index: number, field: keyof IngredientRow, value: string) => {
    setIngredientRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addIngredient = () => {
    setIngredientRows((rows) => [...rows, { name: '', quantity: '', unit: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredientRows.length <= 1) return;
    setIngredientRows((rows) => rows.filter((_, i) => i !== index));
  };

  // Step row helpers
  const updateStep = (index: number, value: string) => {
    setStepRows((rows) =>
      rows.map((r, i) => (i === index ? { instruction: value } : r))
    );
  };

  const addStep = () => {
    setStepRows((rows) => [...rows, { instruction: '' }]);
  };

  const removeStep = (index: number) => {
    if (stepRows.length <= 1) return;
    setStepRows((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        cuisine: cuisine.trim() || undefined,
        difficulty: difficulty ?? undefined,
        servings: Math.max(1, parseInt(servings, 10) || 2),
        durationMinutes: parseInt(duration, 10) || undefined,
        sourceType: 'manual' as const,
        ingredients: ingredientRows
          .filter((r) => r.name.trim())
          .map((r, i) => ({
            name: r.name.trim(),
            quantity: r.quantity.trim() ? (parseFloat(r.quantity) || null) : null,
            unit: r.unit.trim() || undefined,
            orderIndex: i,
          })),
        steps: stepRows
          .filter((r) => r.instruction.trim())
          .map((r, i) => ({ orderIndex: i, instruction: r.instruction.trim() })),
      };
      const recipe = await recipesService.save(payload);
      addRecipe(recipe);
      router.replace(`/recipe/${recipe.id}`);
    } catch {
      setError('Could not save recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>New recipe</Text>
          <Text style={styles.sub}>Fill in as much or as little as you like.</Text>

          {/* Title */}
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Pasta al limone"
            autoCapitalize="sentences"
            returnKeyType="next"
          />

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="A brief note about the dish…"
              placeholderTextColor={colors.umber}
              style={[styles.textArea]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Cuisine */}
          <Input
            label="Cuisine"
            value={cuisine}
            onChangeText={setCuisine}
            placeholder="e.g. Italian, Thai, Mexican"
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Servings + Duration */}
          <View style={styles.twoCol}>
            <View style={styles.colField}>
              <Input
                label="Servings"
                value={servings}
                onChangeText={setServings}
                placeholder="2"
                keyboardType="number-pad"
                returnKeyType="next"
              />
            </View>
            <View style={styles.colField}>
              <Input
                label="Duration (min)"
                value={duration}
                onChangeText={setDuration}
                placeholder="30"
                keyboardType="number-pad"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Difficulty */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Difficulty</Text>
            <View style={styles.pillRow}>
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.diffPill, active && styles.diffPillActive]}
                    onPress={() => setDifficulty(active ? null : d)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.diffPillText, active && styles.diffPillTextActive]}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ingredients</Text>
            {ingredientRows.map((row, i) => (
              <View key={i} style={styles.ingredientRow}>
                <View style={styles.ingredientInputs}>
                  <TextInput
                    value={row.name}
                    onChangeText={(v) => updateIngredient(i, 'name', v)}
                    placeholder="Ingredient"
                    placeholderTextColor={colors.umber}
                    style={[styles.inlineInput, styles.ingredientName]}
                    returnKeyType="next"
                  />
                  <TextInput
                    value={row.quantity}
                    onChangeText={(v) => updateIngredient(i, 'quantity', v)}
                    placeholder="Qty"
                    placeholderTextColor={colors.umber}
                    style={[styles.inlineInput, styles.ingredientQty]}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                  <TextInput
                    value={row.unit}
                    onChangeText={(v) => updateIngredient(i, 'unit', v)}
                    placeholder="Unit"
                    placeholderTextColor={colors.umber}
                    style={[styles.inlineInput, styles.ingredientUnit]}
                    returnKeyType="next"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeIngredient(i)}
                  hitSlop={12}
                  activeOpacity={0.7}
                  style={styles.removeBtn}
                >
                  <MaterialCommunityIcons name="close" size={16} color={colors.umber} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient} activeOpacity={0.85}>
              <MaterialCommunityIcons name="plus" size={16} color={colors.terra} />
              <Text style={styles.addRowText}>Add ingredient</Text>
            </TouchableOpacity>
          </View>

          {/* Steps */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Steps</Text>
            {stepRows.map((row, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <TextInput
                  value={row.instruction}
                  onChangeText={(v) => updateStep(i, v)}
                  placeholder={`Step ${i + 1}…`}
                  placeholderTextColor={colors.umber}
                  style={[styles.inlineInput, styles.stepInput]}
                  multiline
                  textAlignVertical="top"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  onPress={() => removeStep(i)}
                  hitSlop={12}
                  activeOpacity={0.7}
                  style={styles.removeBtn}
                >
                  <MaterialCommunityIcons name="close" size={16} color={colors.umber} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addRowBtn} onPress={addStep} activeOpacity={0.85}>
              <MaterialCommunityIcons name="plus" size={16} color={colors.terra} />
              <Text style={styles.addRowText}>Add step</Text>
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Save recipe"
            onPress={handleSave}
            loading={loading}
            disabled={!title.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },
  handleWrap: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sand,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl3,
    gap: spacing.lg,
  },
  title: { ...typeScale.h1, color: colors.espresso },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
    lineHeight: 22,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  textArea: {
    backgroundColor: colors.linen,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: radius.inner,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
    minHeight: 72,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  colField: {
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  diffPill: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  diffPillActive: {
    backgroundColor: colors.espresso,
  },
  diffPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  diffPillTextActive: {
    color: colors.textOnDark,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ingredientInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  ingredientName: {
    flex: 3,
  },
  ingredientQty: {
    flex: 1,
  },
  ingredientUnit: {
    flex: 1.5,
  },
  inlineInput: {
    backgroundColor: colors.linen,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: radius.inner,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.espresso,
  },
  removeBtn: {
    padding: spacing.xs,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderEmphasis,
    backgroundColor: 'transparent',
  },
  addRowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.terra,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.linen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  stepNumberText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.umber,
  },
  stepInput: {
    flex: 1,
    minHeight: 56,
  },
  error: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.rust,
  },
});
