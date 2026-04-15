import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typeScale, spacing } from '@/constants';

export default function CookScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cook along</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { ...typeScale.h1, color: colors.espresso },
});
