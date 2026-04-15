import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { colors, fonts, typeScale, spacing } from '@/constants';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { useRecipesStore } from '@/store/recipes';

export function RecentlySaved() {
  const { recipes, fetch } = useRecipesStore();

  useEffect(() => {
    fetch();
  }, []);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Recently saved</Text>
      {recipes.length === 0 ? (
        <Text style={styles.empty}>Import your first recipe to get started.</Text>
      ) : (
        <FlatList
          data={recipes.slice(0, 10)}
          keyExtractor={(r) => r.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl2,
  },
  heading: {
    ...typeScale.h2,
    color: colors.espresso,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  empty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    paddingHorizontal: spacing.xl,
  },
});
