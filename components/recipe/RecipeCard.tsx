import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import type { Recipe } from '@/types';

const CUISINE_COLORS: Record<string, [string, string]> = {
  Italian:   [colors.ember,   colors.rust],
  Korean:    [colors.peach,   colors.ember],
  Japanese:  [colors.sand,    colors.umber],
  Levantine: [colors.butter,  colors.peach],
  Side:      [colors.linen,   colors.sand],
};

function getPlaceholderColors(cuisine?: string): [string, string] {
  return (cuisine ? CUISINE_COLORS[cuisine] : undefined) ?? [colors.ember, colors.rust];
}

interface RecipeCardProps {
  recipe: Recipe;
  width?: number;
}

export function RecipeCard({ recipe, width = 200 }: RecipeCardProps) {
  const router = useRouter();
  const [baseColor, overlayColor] = getPlaceholderColors(recipe.cuisine);

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.imageWrapper}>
        {recipe.coverImageUrl ? (
          <Image source={{ uri: recipe.coverImageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, { backgroundColor: baseColor }]}>
            {/* Diagonal stripe texture */}
            <View style={styles.stripes} />
            {/* Dark overlay for gradient depth */}
            <View style={[styles.gradientOverlay, { backgroundColor: overlayColor }]} />
          </View>
        )}
      </View>
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
  imageWrapper: { position: 'relative' },
  image: {
    width: '100%',
    height: 140,
  },
  stripes: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    // subtle diagonal lines via repeating pattern approximation
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '115deg' }, { scaleX: 10 }],
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
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
