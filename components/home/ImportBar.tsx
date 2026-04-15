import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, radius } from '@/constants';

export function ImportBar() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/import')}
      activeOpacity={0.85}
    >
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>↓</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Import a recipe</Text>
        <Text style={styles.sub}>Paste a TikTok or Reels link</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    backgroundColor: colors.blush,
    borderRadius: radius.inner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    color: colors.terra,
    fontFamily: fonts.bodyMedium,
  },
  text: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 2,
  },
  chevron: {
    fontFamily: fonts.bodyRegular,
    fontSize: 20,
    color: colors.umber,
  },
});
