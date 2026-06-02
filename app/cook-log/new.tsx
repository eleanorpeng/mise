import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Button } from '@/components/ui/Button';
import { cookLogService } from '@/services/cookLog';
import { useCookLogStore } from '@/store/cookLog';
import { useRecipesStore } from '@/store/recipes';
import type { Recipe } from '@/types';

const CAPTION_LIMIT = 80;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return 'Today';
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function NewCookLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; recipeId?: string }>();
  const initialDate = params.date ?? todayIso();

  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);
  const addToStore = useCookLogStore((s) => s.add);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cookedDate, setCookedDate] = useState(initialDate);
  const [recipeId, setRecipeId] = useState<string | null>(params.recipeId ?? null);
  const [caption, setCaption] = useState('');
  const [recipeSheetOpen, setRecipeSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipes.length === 0) fetchRecipes();
  }, [recipes.length, fetchRecipes]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === recipeId) ?? null,
    [recipes, recipeId],
  );

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to pick a meal photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const captureFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to take a meal photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const log = await cookLogService.create({
        imageUri,
        cookedDate,
        recipeId,
        caption: caption.trim() || null,
      });
      addToStore(log);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Could not save your cook.');
      setSubmitting(false);
    }
  };

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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Log a cook</Text>
          <Text style={styles.sub}>
            Save a photo of what you made to your cooking calendar.
          </Text>

          {imageUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity
                style={styles.previewSwap}
                activeOpacity={0.85}
                onPress={pickFromLibrary}
              >
                <MaterialCommunityIcons
                  name="image-edit-outline"
                  size={16}
                  color={colors.textOnDark}
                />
                <Text style={styles.previewSwapText}>Change photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerCard}>
              <View style={styles.pickerIcon}>
                <MaterialCommunityIcons
                  name="image-plus"
                  size={28}
                  color={colors.terra}
                />
              </View>
              <Text style={styles.pickerTitle}>Add a photo</Text>
              <Text style={styles.pickerSub}>
                We&rsquo;ll cut it out and turn it into a sticker.
              </Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  activeOpacity={0.85}
                  onPress={captureFromCamera}
                >
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={18}
                    color={colors.espresso}
                  />
                  <Text style={styles.pickerBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  activeOpacity={0.85}
                  onPress={pickFromLibrary}
                >
                  <MaterialCommunityIcons
                    name="image-multiple-outline"
                    size={18}
                    color={colors.espresso}
                  />
                  <Text style={styles.pickerBtnText}>Library</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>When</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>{formatDate(cookedDate)}</Text>
              <Text style={styles.dateMeta}>{cookedDate}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Recipe (optional)</Text>
            <TouchableOpacity
              style={styles.recipeRow}
              activeOpacity={0.8}
              onPress={() => setRecipeSheetOpen((v) => !v)}
            >
              <Text style={styles.recipeRowText}>
                {selectedRecipe ? selectedRecipe.title : 'Attach a recipe'}
              </Text>
              <MaterialCommunityIcons
                name={recipeSheetOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.umber}
              />
            </TouchableOpacity>
            {recipeSheetOpen && (
              <View style={styles.recipeList}>
                {recipeId !== null && (
                  <TouchableOpacity
                    style={styles.recipeItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setRecipeId(null);
                      setRecipeSheetOpen(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="close-circle-outline"
                      size={18}
                      color={colors.umber}
                    />
                    <Text style={styles.recipeItemText}>Clear selection</Text>
                  </TouchableOpacity>
                )}
                {recipes.length === 0 ? (
                  <Text style={styles.recipeEmpty}>
                    Import a recipe first to attach one.
                  </Text>
                ) : (
                  recipes.slice(0, 12).map((r: Recipe) => {
                    const selected = r.id === recipeId;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.recipeItem,
                          selected && styles.recipeItemSelected,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setRecipeId(r.id);
                          setRecipeSheetOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.recipeItemText,
                            selected && styles.recipeItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {r.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Caption (optional)</Text>
            <TextInput
              value={caption}
              onChangeText={(text) => setCaption(text.slice(0, CAPTION_LIMIT))}
              placeholder="A note for future-you"
              placeholderTextColor={colors.umber}
              style={styles.captionInput}
              multiline
            />
            <Text style={styles.captionMeta}>
              {caption.length}/{CAPTION_LIMIT}
            </Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={submitting ? 'Cutting out your dish…' : 'Save sticker'}
            onPress={handleSubmit}
            disabled={!imageUri}
            loading={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {submitting && (
        <View style={styles.fullLoader} pointerEvents="auto">
          <View style={styles.fullLoaderCard}>
            <ActivityIndicator color={colors.terra} size="large" />
            <Text style={styles.fullLoaderTitle}>Cutting out your dish…</Text>
            <Text style={styles.fullLoaderSub}>
              This usually takes a few seconds.
            </Text>
          </View>
        </View>
      )}
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

  pickerCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingVertical: spacing.xl2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pickerTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.espresso,
  },
  pickerSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.linen,
    borderWidth: 0.5,
    borderColor: colors.sand,
  },
  pickerBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },

  previewWrap: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
  },
  previewSwap: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(44,34,24,0.7)',
  },
  previewSwapText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textOnDark,
  },

  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  dateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  dateMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  recipeRowText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
  },
  recipeList: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    overflow: 'hidden',
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderResting,
  },
  recipeItemSelected: {
    backgroundColor: colors.blush,
  },
  recipeItemText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.espresso,
  },
  recipeItemTextSelected: {
    fontFamily: fonts.bodyMedium,
    color: colors.brick,
  },
  recipeEmpty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    paddingVertical: spacing.lg,
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  captionInput: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
    textAlignVertical: 'top',
  },
  captionMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.umber,
    alignSelf: 'flex-end',
  },
  error: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.rust,
    paddingHorizontal: spacing.xs,
  },

  fullLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,34,24,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullLoaderCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: spacing.xl2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 240,
  },
  fullLoaderTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
    marginTop: spacing.sm,
  },
  fullLoaderSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    textAlign: 'center',
  },
});
