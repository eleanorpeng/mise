import { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import type { PlannedMeal } from '@/types';

interface Props {
  entry: PlannedMeal;
  onPress: () => void;
  onLongPress: () => void;
  onToggleCooked: () => void;
  onSwipeDelete: () => void;
  setPagerEnabled?: (enabled: boolean) => void;
}

const SWIPE_THRESHOLD = -84;

const MEAL_LABEL: Record<PlannedMeal['mealType'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function MealCard({
  entry,
  onPress,
  onLongPress,
  onToggleCooked,
  onSwipeDelete,
  setPagerEnabled,
}: Props) {
  const tx = useRef(new Animated.Value(0)).current;
  const swipingRef = useRef(false);
  const setPagerEnabledRef = useRef(setPagerEnabled);
  setPagerEnabledRef.current = setPagerEnabled;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        swipingRef.current = true;
        setPagerEnabledRef.current?.(false);
      },
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) tx.setValue(Math.max(g.dx, -160));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < SWIPE_THRESHOLD) {
          Animated.timing(tx, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            swipingRef.current = false;
            setPagerEnabledRef.current?.(true);
            onSwipeDelete();
          });
        } else {
          Animated.spring(tx, {
            toValue: 0,
            useNativeDriver: true,
            speed: 18,
            bounciness: 6,
          }).start(() => {
            swipingRef.current = false;
            setPagerEnabledRef.current?.(true);
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start(() => {
          swipingRef.current = false;
          setPagerEnabledRef.current?.(true);
        });
      },
    })
  ).current;

  const cooked = !!entry.cookedAt;
  const recipe = entry.recipe;
  const title = recipe?.title ?? 'Recipe';
  const meta: string[] = [];
  if (entry.servings) meta.push(`${entry.servings} ${entry.servings === 1 ? 'serving' : 'servings'}`);
  if (recipe?.cuisine) meta.push(recipe.cuisine);
  if (recipe?.durationMinutes) meta.push(`${recipe.durationMinutes} min`);

  return (
    <View style={styles.outer}>
      <View style={styles.deleteBg}>
        <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.textOnDark} />
        <Text style={styles.deleteText}>Remove</Text>
      </View>

      <Animated.View
        style={[styles.cardWrap, { transform: [{ translateX: tx }] }]}
        {...pan.panHandlers}
      >
        <Pressable
          onPress={() => {
            if (!swipingRef.current) onPress();
          }}
          onLongPress={onLongPress}
          delayLongPress={280}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <TouchableWithoutFeedback onPress={onToggleCooked}>
            <View style={[styles.checkbox, cooked && styles.checkboxOn]}>
              {cooked && (
                <MaterialCommunityIcons name="check" size={13} color={colors.textOnDark} />
              )}
            </View>
          </TouchableWithoutFeedback>

          <View style={styles.body}>
            <Text style={styles.mealLabel}>{MEAL_LABEL[entry.mealType]}</Text>
            <Text
              style={[styles.title, cooked && styles.titleCooked]}
              numberOfLines={2}
            >
              {title}
            </Text>
            {meta.length > 0 && (
              <Text style={styles.meta} numberOfLines={1}>
                {meta.join(' · ')}
              </Text>
            )}
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.umber}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: spacing.sm,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  deleteBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    backgroundColor: colors.rust,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.xl,
    gap: 8,
    borderRadius: radius.card,
  },
  deleteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textOnDark,
  },
  cardWrap: {
    borderRadius: radius.card,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  cardPressed: {
    backgroundColor: colors.linen,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.sage,
    borderColor: colors.sage,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  mealLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 22,
    color: colors.espresso,
  },
  titleCooked: {
    color: colors.umber,
  },
  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 3,
  },
});
