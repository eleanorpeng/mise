import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { Urbanist_400Regular, Urbanist_500Medium } from '@expo-google-fonts/urbanist';

export function useMiseFonts() {
  return useFonts({
    DMSerifDisplay_400Regular,
    Urbanist_400Regular,
    Urbanist_500Medium,
  });
}
