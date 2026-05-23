import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useMiseFonts } from '@/hooks/useFonts';
import { useSessionStore } from '@/store/session';
import { usePreferencesStore } from '@/store/preferences';
import { usePlanStore } from '@/store/plan';
import { useProfileStore } from '@/store/profile';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { colors } from '@/constants';
import { useEffect } from 'react';

export default function RootLayout() {
  const [fontsLoaded] = useMiseFonts();
  const initialize = useSessionStore((s) => s.initialize);
  const session = useSessionStore((s) => s.session);
  const sessionLoading = useSessionStore((s) => s.loading);
  const profile = useProfileStore((s) => s.profile);
  const profileLoaded = useProfileStore((s) => s.loaded);

  useEffect(() => {
    initialize();
    usePreferencesStore.getState().hydrate();
    usePlanStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (session) {
      useProfileStore.getState().fetch();
    } else {
      useProfileStore.getState().reset();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session || !profileLoaded) return;
    if (profile && !profile.onboardedAt) {
      router.replace('/onboarding' as any);
    }
  }, [session, profileLoaded, profile?.onboardedAt]);

  if (!fontsLoaded || sessionLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.oat, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.terra} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={colors.oat} />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.oat} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.oat } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="chef" options={{ presentation: 'card' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cook-log/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cook-log/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen
          name="onboarding"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="profile/stats" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile/units" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile/notifications" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile/account" options={{ presentation: 'card' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
