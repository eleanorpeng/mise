import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
        <MaterialCommunityIcons name="link-variant" size={20} color={colors.textOnDark} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Import a recipe</Text>
        <Text style={styles.sub}>Paste a TikTok or Reels link</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.umber} />
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
    marginBottom: spacing.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    backgroundColor: colors.terra,
    borderRadius: radius.inner,
    alignItems: 'center',
    justifyContent: 'center',
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
});
