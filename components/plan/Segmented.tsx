import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radius } from '@/constants';

export type PlanTab = 'plan' | 'grocery';

interface Props {
  value: PlanTab;
  onChange: (next: PlanTab) => void;
  groceryCount?: number;
}

const TABS: Array<{ id: PlanTab; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'grocery', label: 'Grocery' },
];

export function Segmented({ value, onChange, groceryCount }: Props) {
  return (
    <View style={styles.wrap}>
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(t.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
            {t.id === 'grocery' && groceryCount && groceryCount > 0 ? (
              <View style={[styles.badge, active && styles.badgeOn]}>
                <Text style={[styles.badgeText, active && styles.badgeTextOn]}>
                  {groceryCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.linen,
    borderRadius: radius.pill,
    padding: 4,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.cardBg,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.umber,
  },
  labelActive: {
    color: colors.espresso,
  },
  badge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: {
    backgroundColor: colors.terra,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.espresso,
  },
  badgeTextOn: {
    color: colors.textOnDark,
  },
});
