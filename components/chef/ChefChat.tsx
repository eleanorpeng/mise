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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { useChefHistoryStore } from '@/store/chefHistory';
import { ChefHistorySheet } from './ChefHistorySheet';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeExtraction | null;
  suggestions?: string[];
}

let _idSeq = 0;
const nextId = () => `t${++_idSeq}`;

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

function AssistantText({ text }: { text: string }) {
  return <Text style={styles.assistantText}>{text}</Text>;
}

function StopButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 0.88,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.75,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.send}>
      <Animated.View
        style={[styles.stopGlyph, { transform: [{ scale }], opacity }]}
      />
    </TouchableOpacity>
  );
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

export function ChefChat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fetchRecipes = useRecipesStore((s) => s.fetch);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);

  const hydrateHistory = useChefHistoryStore((s) => s.hydrate);
  const historyHydrated = useChefHistoryStore((s) => s.hydrated);
  const startNewConvo = useChefHistoryStore((s) => s.startNew);
  const setCurrentConvo = useChefHistoryStore((s) => s.setCurrent);
  const saveTurnsToHistory = useChefHistoryStore((s) => s.saveTurns);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isResponding = pending || streamingId !== null;

  // Hydrate the conversation list on mount. The active conversation (if any)
  // gets its messages loaded lazily — only when the user reopens an old chat
  // via the history sheet, so we don't pay for a turns fetch every app launch.
  useEffect(() => {
    if (historyHydrated) return;
    hydrateHistory();
  }, [historyHydrated, hydrateHistory]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async (text: string, priorTurns: Turn[]) => {
    setError(null);
    if (!useChefHistoryStore.getState().currentId) {
      // Wait for the server-issued id so the immediate saveTurns below has
      // somewhere to land. If creation fails (offline / outage), continue
      // anyway — saveTurns will quietly no-op and the user can still chat.
      await startNewConvo();
    }
    const userTurn: Turn = { id: nextId(), role: 'user', content: text };
    const withUser = [...priorTurns, userTurn];
    setTurns(withUser);
    saveTurnsToHistory(withUser);
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

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantId: string | null = null;
    let accumulated = '';

    try {
      await chefService.chatStream(apiMessages, profileContext, {
        signal: controller.signal,
        onDelta: (delta) => {
          if (!delta) return;
          accumulated += delta;
          if (!assistantId) {
            const newId = nextId();
            assistantId = newId;
            setPending(false);
            setStreamingId(newId);
            setTurns((prev) => [
              ...prev,
              { id: newId, role: 'assistant', content: accumulated },
            ]);
          } else {
            const id = assistantId;
            setTurns((prev) =>
              prev.map((t) => (t.id === id ? { ...t, content: accumulated } : t)),
            );
          }
          scrollToEnd();
        },
        onDone: (final) => {
          if (controller.signal.aborted) return;
          if (!assistantId) assistantId = nextId();
          const finalTurn: Turn = {
            id: assistantId,
            role: 'assistant',
            content: final.reply,
            recipe: final.recipe,
            suggestions: final.suggestions,
          };
          const nextTurns: Turn[] = [...withUser, finalTurn];
          setTurns(nextTurns);
          saveTurnsToHistory(nextTurns);
          setStreamingId(null);

          if (final.learned) {
            const cur = useProfileStore.getState().profile;
            const dietary = uniqueMerge(
              cur?.dietaryRestrictions,
              final.learned.dietary_restrictions,
            );
            const cuisines = uniqueMerge(
              cur?.cuisinePreferences,
              final.learned.cuisine_preferences,
            );
            const changed =
              dietary.length !== (cur?.dietaryRestrictions?.length ?? 0) ||
              cuisines.length !== (cur?.cuisinePreferences?.length ?? 0);
            if (changed) {
              useProfileStore
                .getState()
                .update({
                  dietaryRestrictions: dietary,
                  cuisinePreferences: cuisines,
                })
                .catch(() => {});
            }
          }
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      setError(err?.message || 'The chef is unavailable. Try again.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(false);
      setStreamingId((id) => (id === assistantId ? null : id));
      scrollToEnd();
    }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isResponding) return;
    setDraft('');
    send(text, turns);
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setPending(false);
    setStreamingId(null);
  };

  const handleNewChat = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCurrentConvo(null);
    setTurns([]);
    setDraft('');
    setError(null);
    setStreamingId(null);
    setPending(false);
    setSavingId(null);
    setSavedId(null);
  };

  const handleOpenConversation = async (id: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCurrentConvo(id);
    setDraft('');
    setError(null);
    setStreamingId(null);
    setPending(true);
    setSavingId(null);
    setSavedId(null);
    setHistoryOpen(false);
    const loaded = await useChefHistoryStore.getState().loadTurns(id);
    setPending(false);
    if (loaded) {
      setTurns(loaded);
      scrollToEnd();
    } else {
      setError('Could not load that chat.');
    }
  };

  const handleSave = async (turn: Turn) => {
    if (!turn.recipe || savingId) return;
    setSavingId(turn.id);
    try {
      const saved = await chefService.save(turn.recipe);
      setSavedId(turn.id);
      fetchRecipes();
      router.push(`/recipe/${saved.id}`);
    } catch (err: any) {
      setError(err?.message || 'Could not save the recipe.');
    } finally {
      setSavingId(null);
    }
  };

  const isEmpty = turns.length === 0 && !pending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => setHistoryOpen(true)}
          hitSlop={10}
          style={styles.headerBtn}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="history"
            size={16}
            color={colors.umber}
          />
          <Text style={styles.headerBtnText}>History</Text>
        </TouchableOpacity>
        {turns.length > 0 ? (
          <TouchableOpacity
            onPress={handleNewChat}
            hitSlop={10}
            style={styles.headerBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="square-edit-outline"
              size={16}
              color={colors.umber}
            />
            <Text style={styles.headerBtnText}>New chat</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEyebrow}>Ask the chef</Text>
          <Text style={styles.emptyTitle}>What's in your kitchen?</Text>
          <Text style={styles.emptyHelp}>
            Tell me the ingredients you have and I'll suggest a dish — I might
            ask a question or two first.
          </Text>
        </View>
      ) : (
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
                <AssistantText text={t.content} />
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
      )}

      <View style={[styles.composer, { paddingBottom: insets.bottom + 64 }]}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder="List ingredients you have…"
          placeholderTextColor={colors.umber}
          style={styles.composerInput}
          selectionColor={colors.terra}
          cursorColor={colors.terra}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        {isResponding ? (
          <StopButton onPress={handleStop} />
        ) : (
          <TouchableOpacity
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={!draft.trim()}
          >
            <MaterialCommunityIcons name="arrow-up" size={20} color={colors.textOnDark} />
          </TouchableOpacity>
        )}
      </View>

      <ChefHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onOpenConversation={handleOpenConversation}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.linen,
  },
  headerBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.umber,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl3,
    gap: spacing.sm,
  },
  emptyEyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.espresso,
    textAlign: 'center',
  },
  emptyHelp: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.umber,
    textAlign: 'center',
    marginTop: 4,
  },

  thread: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl2,
    gap: spacing.xl,
  },

  userRow: { alignItems: 'flex-end' },
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

  assistantRow: { alignItems: 'flex-start' },
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
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textOnDark,
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
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
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
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  stopGlyph: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.textOnDark,
  },
});
