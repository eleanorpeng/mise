import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing } from '@/constants';
import { Avatar } from '@/components/ui/Avatar';
import { WeekCard } from '@/components/home/WeekCard';
import { ImportBar } from '@/components/home/ImportBar';
import { RecentlySaved } from '@/components/home/RecentlySaved';
import { useGreeting } from '@/hooks/useGreeting';

export default function HomeScreen() {
  const { sublabel, title } = useGreeting();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>mise</Text>
          <Avatar initials="Y" onPress={() => router.push('/(tabs)/profile')} />
        </View>

        <View style={styles.greeting}>
          <Text style={styles.greetingSub}>{sublabel}</Text>
          <Text style={styles.greetingTitle}>{title}</Text>
        </View>

        <WeekCard mealsPlanned={3} totalMeals={7} />
        <ImportBar />
        <RecentlySaved />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  content: { paddingBottom: spacing.xl3 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.espresso,
    letterSpacing: 0.3,
  },
  greeting: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  greetingSub: {
    ...typeScale.caption,
    color: colors.umber,
    marginBottom: 4,
  },
  greetingTitle: {
    ...typeScale.h1,
    color: colors.espresso,
  },
});
