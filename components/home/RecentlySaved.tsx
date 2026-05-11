import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing } from '@/constants';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { useRecipesStore } from '@/store/recipes';

export function RecentlySaved() {
  const { recipes, fetch } = useRecipesStore();
  const router = useRouter();

  useEffect(() => {
    fetch();
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Recently saved</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/recipes')} activeOpacity={0.7}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  heading: {
    ...typeScale.h2,
    color: colors.espresso,
  },
  seeAll: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.terra,
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
