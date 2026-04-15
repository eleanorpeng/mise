import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing } from '@/constants';

const TAB_CONFIG: Record<string, { label: string; icon: string; iconActive: string }> = {
  index:   { label: 'Home',    icon: 'home-outline',         iconActive: 'home' },
  recipes: { label: 'Recipes', icon: 'book-open-outline',    iconActive: 'book-open' },
  plan:    { label: 'Plan',    icon: 'calendar-outline',     iconActive: 'calendar' },
  cook:    { label: 'Cook',    icon: 'pot-steam-outline',    iconActive: 'pot-steam' },
  profile: { label: 'Profile', icon: 'account-outline',      iconActive: 'account' },
};

function MiseTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((r) => TAB_CONFIG[r.name]);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const index = state.routes.indexOf(route);
          const isFocused = state.index === index;
          const { label, icon, iconActive } = TAB_CONFIG[route.name];

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => !isFocused && navigation.navigate(route.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                <MaterialCommunityIcons
                  name={isFocused ? iconActive : icon}
                  size={22}
                  color={isFocused ? colors.textOnDark : 'rgba(245,239,224,0.45)'}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <MiseTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="recipes" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="cook" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.espresso,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,239,224,0.12)',
  },
  bar: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-start',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrapper: {
    width: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  iconWrapperActive: {
    backgroundColor: colors.terra,
  },
  tabLabel: {
    fontSize: 14,
  },
  tabLabelActive: {
    fontFamily: fonts.bodyMedium,
    color: colors.ember,
  },
  tabLabelInactive: {
    fontFamily: fonts.bodyRegular,
    color: 'rgba(245,239,224,0.45)',
  },
});
