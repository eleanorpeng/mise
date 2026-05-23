import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import {
  chefService,
  type ChatMessage,
  type ProfileContext,
  type RecipeExtraction,
} from '@/services/chef';
import { useRecipesStore } from '@/store/recipes';
import { useProfileStore } from '@/store/profile';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeExtraction | null;
  suggestions?: string[];
}

function uniqueMerge(a: string[] = [], b: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...a, ...b]) {
    const key = v.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(v.trim());
    }
  }
  return out;
}

let _idSeq = 0;
const nextId = () => `t${++_idSeq}`;

// Progressive word-by-word reveal — gives assistant replies the streaming
// feel of Claude without server-sent events. Calls onDone when fully shown.
function AssistantText({
  text,
  animate,
  onTick,
  onDone,
}: {
  text: string;
  animate: boolean;
  onTick?: () => void;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setShown(text);
      return;
    }
    const words = text.split(' ');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(words.slice(0, i).join(' '));
      onTick?.();
      if (i >= words.length) {
        clearInterval(id);
        onDone?.();
      }
    }, 26);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);

  return <Text style={styles.assistantText}>{shown}</Text>;
}

function ThinkingDots() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(a, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });
  return (
    <View style={styles.assistantRow}>
      <Animated.View style={[styles.thinkingDot, { opacity }]} />
    </View>
  );
}

function metaLine(recipe: RecipeExtraction): string {
  const bits: string[] = [];
  if (recipe.cuisine) bits.push(recipe.cuisine);
  if (recipe.duration_minutes) bits.push(`${recipe.duration_minutes} min`);
  if (recipe.servings) bits.push(`serves ${recipe.servings}`);
  if (recipe.difficulty) bits.push(recipe.difficulty);
  return bits.join(' · ');
}

function RecipePreview({
  recipe,
  onSave,
  saving,
  saved,
}: {
  recipe: RecipeExtraction;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const meta = metaLine(recipe);
  return (
    <View style={styles.recipeCard}>
      <Text style={styles.recipeTitle}>{recipe.title}</Text>
      {recipe.description ? (
        <Text style={styles.recipeDesc}>{recipe.description}</Text>
      ) : null}
      {meta ? <Text style={styles.recipeMeta}>{meta}</Text> : null}

      <Text style={styles.recipeSection}>Ingredients</Text>
      {recipe.ingredients.map((ing, i) => {
        const qty = [ing.quantity ?? '', ing.unit ?? ''].join(' ').trim();
        return (
          <Text key={i} style={styles.recipeLine}>
            • {qty ? `${qty} ` : ''}
            {ing.name}
            {ing.notes ? `, ${ing.notes}` : ''}
          </Text>
        );
      })}

      <Text style={styles.recipeSection}>Steps</Text>
      {recipe.steps.map((s, i) => (
        <Text key={i} style={styles.recipeLine}>
          {i + 1}. {s.instruction}
        </Text>
      ))}

      <TouchableOpacity
        style={[styles.saveBtn, (saving || saved) && styles.saveBtnDisabled]}
        activeOpacity={0.85}
        onPress={onSave}
        disabled={saving || saved}
      >
        {saving ? (
          <ActivityIndicator color={colors.textOnDark} />
        ) : (
          <Text style={styles.saveBtnText}>
            {saved ? 'Saved ✓' : 'Save to my recipes'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ChefScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q: string }>();
  const fetchRecipes = useRecipesStore((s) => s.fetch);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // The assistant turn currently revealing its text; recipe waits for it.
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const startedRef = useRef(false);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async (text: string, priorTurns: Turn[]) => {
    setError(null);
    const userTurn: Turn = { id: nextId(), role: 'user', content: text };
    const withUser = [...priorTurns, userTurn];
    setTurns(withUser);
    setPending(true);
    scrollToEnd();

    const apiMessages: ChatMessage[] = withUser.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    const profile = useProfileStore.getState().profile;
    const profileContext: ProfileContext | undefined = profile
      ? {
          display_name: profile.displayName,
          dietary_restrictions: profile.dietaryRestrictions,
          cuisine_preferences: profile.cuisinePreferences,
          skill_level: profile.skillLevel,
        }
      : undefined;

    try {
      const res = await chefService.chat(apiMessages, profileContext);
      const assistantId = nextId();
      setStreamingId(assistantId);
      setTurns((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: res.reply,
          recipe: res.recipe,
          suggestions: res.suggestions,
        },
      ]);

      // Remember durable preferences the user stated, so future chats skip
      // questions we already know the answer to.
      if (res.learned) {
        const cur = useProfileStore.getState().profile;
        const dietary = uniqueMerge(
          cur?.dietaryRestrictions,
          res.learned.dietary_restrictions,
        );
        const cuisines = uniqueMerge(
          cur?.cuisinePreferences,
          res.learned.cuisine_preferences,
        );
        const changed =
          dietary.length !== (cur?.dietaryRestrictions?.length ?? 0) ||
          cuisines.length !== (cur?.cuisinePreferences?.length ?? 0);
        if (changed) {
          useProfileStore
            .getState()
            .update({ dietaryRestrictions: dietary, cuisinePreferences: cuisines })
            .catch(() => {});
        }
      }
    } catch (err: any) {
      setError(err?.message || 'The chef is unavailable. Try again.');
    } finally {
      setPending(false);
      scrollToEnd();
    }
  };

  // Kick off with the ingredients the user typed on the recipes tab.
  useEffect(() => {
    if (startedRef.current) return;
    const initial = (q || '').trim();
    if (!initial) return;
    startedRef.current = true;
    send(initial, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft('');
    send(text, turns);
  };

  const handleSave = async (turn: Turn) => {
    if (!turn.recipe || savingId) return;
    setSavingId(turn.id);
    try {
      const saved = await chefService.save(turn.recipe);
      setSavedId(turn.id);
      fetchRecipes();
      router.replace(`/recipe/${saved.id}`);
    } catch (err: any) {
      setError(err?.message || 'Could not save the recipe.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <MaterialCommunityIcons name="close" size={22} color={colors.espresso} />
        </TouchableOpacity>
        <Text style={styles.title}>Ask the chef</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
        >
          {turns.map((t, idx) => {
            if (t.role === 'user') {
              return (
                <View key={t.id} style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText}>{t.content}</Text>
                  </View>
                </View>
              );
            }
            const isStreaming = streamingId === t.id;
            const isLast = idx === turns.length - 1;
            const showSuggestions =
              isLast &&
              !isStreaming &&
              !pending &&
              !!t.suggestions &&
              t.suggestions.length > 0;
            return (
              <View key={t.id} style={styles.assistantRow}>
                <AssistantText
                  text={t.content}
                  animate={isStreaming}
                  onTick={scrollToEnd}
                  onDone={() => setStreamingId((id) => (id === t.id ? null : id))}
                />
                {t.recipe && !isStreaming ? (
                  <RecipePreview
                    recipe={t.recipe}
                    onSave={() => handleSave(t)}
                    saving={savingId === t.id}
                    saved={savedId === t.id}
                  />
                ) : null}
                {showSuggestions ? (
                  <View style={styles.suggestionWrap}>
                    {t.suggestions!.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.suggestionChip}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (pending) return;
                          send(s, turns);
                        }}
                      >
                        <Text style={styles.suggestionText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.suggestionChip, styles.suggestionChipCustom]}
                      activeOpacity={0.8}
                      onPress={() => inputRef.current?.focus()}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={14}
                        color={colors.umber}
                      />
                      <Text style={styles.suggestionTextCustom}>Something else…</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}

          {pending ? <ThinkingDots /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder="Reply with a message…"
            placeholderTextColor={colors.umber}
            style={styles.composerInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.send, (!draft.trim() || pending) && styles.sendDisabled]}
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={!draft.trim() || pending}
          >
            <MaterialCommunityIcons name="arrow-up" size={20} color={colors.textOnDark} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.espresso,
  },

  thread: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl2,
    gap: spacing.xl,
  },

  // User: subtle contained bubble, right-aligned (Claude-style)
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '88%',
    backgroundColor: colors.linen,
    borderRadius: radius.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.espresso,
  },

  // Assistant: full-width plain text, no bubble
  assistantRow: {
    alignItems: 'flex-start',
  },
  assistantText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.espresso,
  },
  thinkingDot: {
    width: 9,
    height: 9,
    borderRadius: radius.avatar,
    backgroundColor: colors.terra,
  },

  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  suggestionChip: {
    backgroundColor: colors.linen,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  suggestionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.espresso,
  },
  suggestionChipCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
    borderColor: colors.borderEmphasis,
  },
  suggestionTextCustom: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },

  recipeCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: 4,
  },
  recipeTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.espresso,
  },
  recipeDesc: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.umber,
    marginTop: 2,
  },
  recipeMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.peach,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  recipeSection: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  recipeLine: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.espresso,
  },
  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.terra,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textOnDark,
  },

  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.rust,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.linen,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.sand,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
    maxHeight: 110,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.avatar,
    backgroundColor: colors.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
});
