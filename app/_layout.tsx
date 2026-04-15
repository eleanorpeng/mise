import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useMiseFonts } from '@/hooks/useFonts';
import { colors } from '@/constants';

export default function RootLayout() {
  const [fontsLoaded] = useMiseFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.oat, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.terra} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.oat} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.oat } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
