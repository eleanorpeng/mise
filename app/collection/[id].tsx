import { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing } from '@/constants';
import { useCollectionsStore } from '@/store/collections';
import { useRecipesStore } from '@/store/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import type { Recipe } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const collection = useCollectionsStore((s) =>
    s.collections.find((c) => c.id === id),
  );
  const fetchCollections = useCollectionsStore((s) => s.fetch);
  const removeRecipe = useCollectionsStore((s) => s.removeRecipe);
  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);

  useEffect(() => {
    if (!collection) fetchCollections();
    if (recipes.length === 0) fetchRecipes();
  }, [collection, recipes.length, fetchCollections, fetchRecipes]);

  if (!collection) return null;

  const collectionRecipes = recipes.filter((r) =>
    collection.recipeIds.includes(r.id),
  );

  const handleLongPress = (recipe: Recipe) => {
    Alert.alert(
      'Remove from cookbook?',
      `Remove “${recipe.title}” from “${collection.name}”? The recipe itself will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeRecipe(collection.id, recipe.id),
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      onLongPress={() => handleLongPress(item)}
      delayLongPress={350}
      activeOpacity={0.85}
    >
      <RecipeCard recipe={item} width={CARD_WIDTH} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.safe}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: collection.coverColor,
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={12}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={collection.inkColor}
          />
          <Text style={[styles.backText, { color: collection.inkColor }]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: collection.inkColor }]}>
          {collection.name}
        </Text>
        <Text style={[styles.subtitle, { color: collection.inkColor }]}>
          {collectionRecipes.length}{' '}
          {collectionRecipes.length === 1 ? 'recipe' : 'recipes'}
        </Text>
      </View>

      <FlatList
        data={collectionRecipes}
        keyExtractor={(r) => r.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>This cookbook is empty</Text>
            <Text style={styles.empty}>
              Open any recipe and tap “Add to cookbook” to file it here.
            </Text>
          </View>
        }
        ListFooterComponent={
          collectionRecipes.length > 0 ? (
            <Text style={styles.hint}>
              Long-press a recipe to remove it from this cookbook.
            </Text>
          ) : null
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl2,
    gap: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginLeft: 2,
  },
  title: { ...typeScale.h1 },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    opacity: 0.7,
  },
  list: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.md,
  },
  row: { gap: spacing.md },
  emptyWrap: {
    paddingVertical: spacing.xl3,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
    textAlign: 'center',
  },
  empty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    textAlign: 'center',
    lineHeight: 21,
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
