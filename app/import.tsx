import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing } from '@/constants';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { importService } from '@/services/import';
import { useRecipesStore } from '@/store/recipes';

export default function ImportScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const addRecipe = useRecipesStore((s) => s.add);

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const recipe = await importService.fromUrl(url.trim());
      addRecipe(recipe);
      router.replace(`/recipe/${recipe.id}`);
    } catch {
      setError('Could not import recipe. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.title}>Import a recipe</Text>
          <Text style={styles.sub}>Paste a TikTok or Instagram Reels link below.</Text>

          <Input
            label="Video URL"
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.tiktok.com/@..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Import recipe" onPress={handleImport} loading={loading} disabled={!url.trim()} />
          <Button label="Take a photo instead" variant="secondary" onPress={() => {}} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xl3,
    gap: spacing.lg,
    flex: 1,
  },
  title: { ...typeScale.h1, color: colors.espresso },
  sub: { fontFamily: fonts.bodyRegular, fontSize: 15, color: colors.umber, lineHeight: 22 },
  error: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.rust },
});
