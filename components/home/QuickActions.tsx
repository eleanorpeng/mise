import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';

export function QuickActions() {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Quick actions</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.btnAccent]}
          onPress={() => router.push('/(tabs)/plan')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="calendar" size={16} color={colors.textOnDark} />
          <Text style={[styles.btnText, styles.btnTextAccent]}>Open planner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnDefault]}
          onPress={() => router.push('/import')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="link-variant" size={16} color={colors.espresso} />
          <Text style={[styles.btnText, styles.btnTextDefault]}>Import recipe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  heading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radius.card,
  },
  btnAccent: {
    backgroundColor: colors.terra,
  },
  btnDefault: {
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  btnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  btnTextAccent: {
    color: colors.textOnDark,
  },
  btnTextDefault: {
    color: colors.espresso,
  },
});
