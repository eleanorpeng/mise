import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, typeScale, spacing } from '@/constants';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Recipe detail</Text>
        <Text style={styles.id}>{id}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { ...typeScale.h1, color: colors.espresso },
  id: { ...typeScale.body, color: colors.umber },
});
