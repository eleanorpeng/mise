import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import type { Recipe } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  width?: number;
}

export function RecipeCard({ recipe, width = 180 }: RecipeCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.imageWrapper}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {recipe.totalTime && (
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{recipe.totalTime} min</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        {recipe.cuisine && <Text style={styles.cuisine}>{recipe.cuisine}</Text>}
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
  imageWrapper: { position: 'relative' },
  image: { width: '100%', aspectRatio: 4 / 3 },
  imagePlaceholder: { backgroundColor: colors.linen },
  timeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(44,34,24,0.68)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  timeText: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.oat },
  body: { padding: spacing.md, gap: 4 },
  title: { ...typeScale.cardTitle, color: colors.espresso },
  cuisine: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.umber },
});
