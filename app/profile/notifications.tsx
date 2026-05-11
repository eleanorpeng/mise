import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { colors, fonts, radius, spacing } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { usePreferencesStore } from '@/store/preferences';

interface ToggleConfig {
  key: 'cookReminders' | 'weeklyRecap' | 'importComplete' | 'groceryReminders';
  title: string;
  description: string;
}

const NOTIFICATIONS: ToggleConfig[] = [
  {
    key: 'cookReminders',
    title: 'Cook reminders',
    description: 'A nudge in the morning when meals are planned for the day.',
  },
  {
    key: 'weeklyRecap',
    title: 'Weekly recap ready',
    description: 'Get notified when your shareable weekly summary is ready.',
  },
  {
    key: 'importComplete',
    title: 'Import complete',
    description: "Tell me when a video or photo finishes processing.",
  },
  {
    key: 'groceryReminders',
    title: 'Grocery reminders',
    description: "Remind me to pick up ingredients before the week starts.",
  },
];

export default function NotificationsScreen() {
  const notifications = usePreferencesStore((s) => s.notifications);
  const setNotification = usePreferencesStore((s) => s.setNotification);

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Notifications" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Pick which moments mise can reach out for. You can change this any time.
        </Text>

        <View style={styles.card}>
          {NOTIFICATIONS.map((item, i) => (
            <View key={item.key}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSub}>{item.description}</Text>
                </View>
                <Switch
                  value={notifications[item.key]}
                  onValueChange={(v) => setNotification(item.key, v)}
                  trackColor={{ false: colors.sand, true: colors.terra }}
                  thumbColor={colors.cardBg}
                  ios_backgroundColor={colors.sand}
                />
              </View>
              {i < NOTIFICATIONS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          System-level permission is required for notifications to actually
          arrive — we'll ask the first time one fires.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl4,
    gap: spacing.lg,
  },
  intro: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  rowSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderResting,
    marginLeft: spacing.lg,
  },
  footnote: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    lineHeight: 17,
    paddingHorizontal: spacing.xs,
  },
});
