import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { importService } from '@/services/import';
import { useRecipesStore } from '@/store/recipes';

type Mode = 'choose' | 'url' | 'photo';

export default function ImportScreen() {
  const [mode, setMode] = useState<Mode>('choose');
  const [url, setUrl] = useState('');
  const [fast, setFast] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const addRecipe = useRecipesStore((s) => s.add);

  const resetError = () => setError(null);

  const handleImportUrl = async () => {
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

  const handleImportPhoto = async () => {
    if (!imageUri) return;
    setLoading(true);
    setError(null);
    try {
      const recipe = await importService.fromPhoto(imageUri, {
        caption: caption.trim() || undefined,
      });
      addRecipe(recipe);
      router.replace(`/recipe/${recipe.id}`);
    } catch (err: any) {
      console.error('[photo import]', err);
      setError(err?.message ? `Photo import failed: ${err.message}` : 'Could not read that photo. Try a clearer shot of the dish.');
    } finally {
      setLoading(false);
    }
  };

  const pickFromLibrary = async () => {
    resetError();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to choose a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const captureFromCamera = async () => {
    resetError();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const goBackToChoose = () => {
    resetError();
    setMode('choose');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {mode !== 'choose' && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={goBackToChoose}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={colors.umber}
              />
              <Text style={styles.backText}>Choose another way</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title}>Import a recipe</Text>
          <Text style={styles.sub}>
            {mode === 'choose'
              ? 'Start from a video link or a photo of a dish.'
              : mode === 'url'
                ? 'Paste a TikTok or Instagram Reels link below.'
                : 'Snap or pick a clear photo of the finished dish.'}
          </Text>

          {mode === 'choose' && (
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={styles.choiceCard}
                activeOpacity={0.85}
                onPress={() => {
                  resetError();
                  setMode('url');
                }}
              >
                <View style={styles.choiceIcon}>
                  <MaterialCommunityIcons
                    name="link-variant"
                    size={26}
                    color={colors.terra}
                  />
                </View>
                <Text style={styles.choiceTitle}>Paste URL</Text>
                <Text style={styles.choiceSub}>TikTok or Reels link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.choiceCard}
                activeOpacity={0.85}
                onPress={() => {
                  resetError();
                  setMode('photo');
                }}
              >
                <View style={styles.choiceIcon}>
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={26}
                    color={colors.terra}
                  />
                </View>
                <Text style={styles.choiceTitle}>Upload photo</Text>
                <Text style={styles.choiceSub}>Of a finished dish</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'url' && (
            <>
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
                onPress={handleImportUrl}
                loading={loading}
                disabled={!url.trim()}
              />
            </>
          )}

          {mode === 'photo' && (
            <>
              {imageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.preview} />
                  <TouchableOpacity
                    style={styles.previewSwap}
                    activeOpacity={0.85}
                    onPress={pickFromLibrary}
                  >
                    <MaterialCommunityIcons
                      name="image-edit-outline"
                      size={16}
                      color={colors.textOnDark}
                    />
                    <Text style={styles.previewSwapText}>Change photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickerCard}>
                  <View style={styles.pickerIcon}>
                    <MaterialCommunityIcons
                      name="image-plus"
                      size={28}
                      color={colors.terra}
                    />
                  </View>
                  <Text style={styles.pickerTitle}>Add a photo</Text>
                  <Text style={styles.pickerSub}>
                    A clear, well-lit shot of the plated dish works best.
                  </Text>
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={styles.pickerBtn}
                      activeOpacity={0.85}
                      onPress={captureFromCamera}
                    >
                      <MaterialCommunityIcons
                        name="camera-outline"
                        size={18}
                        color={colors.espresso}
                      />
                      <Text style={styles.pickerBtnText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerBtn}
                      activeOpacity={0.85}
                      onPress={pickFromLibrary}
                    >
                      <MaterialCommunityIcons
                        name="image-multiple-outline"
                        size={18}
                        color={colors.espresso}
                      />
                      <Text style={styles.pickerBtnText}>Library</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.captionField}>
                <Text style={styles.captionLabel}>Hint (optional)</Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="e.g. pad see ew from a Thai restaurant"
                  placeholderTextColor={colors.umber}
                  style={styles.captionInput}
                  multiline
                />
                <Text style={styles.captionHelp}>
                  A short hint about the dish makes the recipe much more accurate.
                </Text>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                label="Import recipe"
                onPress={handleImportPhoto}
                loading={loading}
                disabled={!imageUri}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && mode === 'photo' && (
        <View style={styles.fullLoader} pointerEvents="auto">
          <View style={styles.fullLoaderCard}>
            <ActivityIndicator color={colors.terra} size="large" />
            <Text style={styles.fullLoaderTitle}>Reading the dish…</Text>
            <Text style={styles.fullLoaderSub}>
              Identifying ingredients and steps.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },
  handleWrap: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sand,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl3,
    gap: spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: -spacing.sm,
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  title: { ...typeScale.h1, color: colors.espresso },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
    lineHeight: 22,
  },

  choiceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  choiceCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  choiceTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
  },
  choiceSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    textAlign: 'center',
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

  pickerCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingVertical: spacing.xl2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pickerTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.espresso,
  },
  pickerSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.linen,
    borderWidth: 0.5,
    borderColor: colors.sand,
  },
  pickerBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },

  previewWrap: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
  },
  previewSwap: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(44,34,24,0.7)',
  },
  previewSwapText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textOnDark,
  },

  captionField: { gap: spacing.xs },
  captionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  captionInput: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
    textAlignVertical: 'top',
  },
  captionHelp: {
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

  fullLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,34,24,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullLoaderCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: spacing.xl2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 240,
  },
  fullLoaderTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
    marginTop: spacing.sm,
  },
  fullLoaderSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    textAlign: 'center',
  },
});
