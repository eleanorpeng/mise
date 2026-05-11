import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts } from '@/constants';

const TAB_CONFIG: Record<string, { label: string; icon: string; iconActive: string }> = {
  index:   { label: 'Home',    icon: 'home-outline',           iconActive: 'home' },
  recipes: { label: 'Recipe',  icon: 'book-outline',           iconActive: 'book' },
  plan:    { label: 'Plan',    icon: 'calendar-month-outline', iconActive: 'calendar-month' },
  cook:    { label: 'Cook',    icon: 'silverware-fork-knife',  iconActive: 'silverware-fork-knife' },
  profile: { label: 'Profile', icon: 'account-outline',        iconActive: 'account' },
};

function MiseTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => TAB_CONFIG[r.name]);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.shadow}>
        <BlurView intensity={90} tint="extraLight" style={styles.pill}>
          <View style={styles.glassSheen} pointerEvents="none" />
          <View style={styles.glassBorder} pointerEvents="none" />

          {visibleRoutes.map((route) => {
            const index = state.routes.indexOf(route);
            const isFocused = state.index === index;
            const { label, icon, iconActive } = TAB_CONFIG[route.name];

            return (
              <TouchableOpacity
                key={route.key}
                style={isFocused ? styles.tabActive : styles.tab}
                onPress={() => !isFocused && navigation.navigate(route.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
                  <MaterialCommunityIcons
                    name={(isFocused ? iconActive : icon) as any}
                    size={20}
                    color={isFocused ? colors.textOnDark : colors.espresso}
                  />
                  {isFocused && (
                    <Text style={styles.activeLabel}>{label}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </BlurView>
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  shadow: {
    borderRadius: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  pill: {
    borderRadius: 34,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  glassSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,239,224,0.55)',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    flex: 1.9,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 22,
  },
  tabInnerActive: {
    backgroundColor: colors.terra,
    paddingHorizontal: 14,
  },
  activeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textOnDark,
    letterSpacing: 0.1,
  },
});
