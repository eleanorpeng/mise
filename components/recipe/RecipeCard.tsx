import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import type { Recipe } from '@/types';
import { RecipeCover } from './RecipeCover';

interface RecipeCardProps {
  recipe: Recipe;
  width?: number;
  onLongPress?: () => void;
}

export function RecipeCard({ recipe, width = 200, onLongPress }: RecipeCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.85}
    >
      <RecipeCover recipe={recipe} style={styles.image} letterSize={68} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        <Text style={styles.meta}>
          {[recipe.durationMinutes ? `${recipe.durationMinutes} min` : null, recipe.cuisine]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 140,
  },
  body: {
    padding: spacing.md,
    gap: 4,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.espresso,
  },
  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
});
