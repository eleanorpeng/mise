import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { importService } from '@/services/import';
import { useRecipesStore } from '@/store/recipes';

export default function ImportScreen() {
  const [url, setUrl] = useState('');
  const [fast, setFast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const addRecipe = useRecipesStore((s) => s.add);

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const recipe = await importService.fromUrl(url.trim(), { fast });
      addRecipe(recipe);
      router.replace(`/recipe/${recipe.id}`);
    } catch {
      setError('Could not import recipe. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Import a recipe</Text>
          <Text style={styles.sub}>
            Paste a TikTok or Instagram Reels link below.
          </Text>

          <Input
            label="Video URL"
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.tiktok.com/@..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.fastRow}>
            <View style={styles.fastText}>
              <Text style={styles.fastTitle}>Fast mode</Text>
              <Text style={styles.fastSub}>
                ~3× faster, slightly less precise quantities and technique
                detail.
              </Text>
            </View>
            <Switch
              value={fast}
              onValueChange={setFast}
              trackColor={{ false: colors.sand, true: colors.terra }}
              thumbColor={colors.cardBg}
              ios_backgroundColor={colors.sand}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Import recipe"
            onPress={handleImport}
            loading={loading}
            disabled={!url.trim()}
          />
          <Button
            label="Take a photo instead"
            variant="secondary"
            onPress={() => {}}
          />
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
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
    lineHeight: 22,
  },
  fastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  fastText: { flex: 1, gap: 2 },
  fastTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  fastSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    lineHeight: 17,
  },
  error: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.rust,
  },
});
