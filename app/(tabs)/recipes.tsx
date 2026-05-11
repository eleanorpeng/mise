import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { useCollectionsStore, type Collection } from '@/store/collections';
import { useRecipesStore } from '@/store/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { BottomFade } from '@/components/ui/BottomFade';

const PALETTES: Array<Pick<Collection, 'coverColor' | 'spineColor' | 'inkColor'>> = [
  { coverColor: '#F5D0BC', spineColor: '#E8A87C', inkColor: '#6C250A' },
  { coverColor: '#D8EACE', spineColor: '#7A9E6A', inkColor: '#3A5C2A' },
  { coverColor: '#FBF0CC', spineColor: '#F0C96A', inkColor: '#7A5C10' },
  { coverColor: '#EDE4CE', spineColor: '#DDD0B3', inkColor: '#9A826A' },
  { coverColor: '#E8A87C', spineColor: '#D4521C', inkColor: '#2C2218' },
  { coverColor: '#C9D8E0', spineColor: '#7A95A4', inkColor: '#28404A' },
];

const BOOK_HEIGHT = 196;

function BookCard({
  collection,
  onPress,
  onLongPress,
}: {
  collection: Collection;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const count = collection.recipeIds.length;

  return (
    <TouchableOpacity
      style={styles.bookOuter}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.88}
    >
      {/* Pages peeking beneath — furthest back to front */}
      <View style={[styles.page, styles.pageFar, { backgroundColor: collection.spineColor, opacity: 0.35 }]} />
      <View style={[styles.page, styles.pageMid, { backgroundColor: colors.linen }]} />
      <View style={[styles.page, styles.pageNear, { backgroundColor: colors.cardBg }]} />

      {/* Book cover */}
      <View style={[styles.book, { backgroundColor: collection.coverColor }]}>
        {/* Spine */}
        <View style={[styles.spine, { backgroundColor: collection.spineColor }]} />

        {/* Cover text */}
        <View style={styles.coverBody}>
          <Text style={[styles.bookTitle, { color: collection.inkColor }]} numberOfLines={3}>
            {collection.name}
          </Text>
          <View style={[styles.countPill, { backgroundColor: 'rgba(0,0,0,0.07)' }]}>
            <Text style={[styles.countText, { color: collection.inkColor }]}>
              {count} {count === 1 ? 'recipe' : 'recipes'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RecipesScreen() {
  const collections = useCollectionsStore((s) => s.collections);
  const fetchCollections = useCollectionsStore((s) => s.fetch);
  const createCollection = useCollectionsStore((s) => s.create);
  const removeCollection = useCollectionsStore((s) => s.remove);
  const recipes = useRecipesStore((s) => s.recipes);
  const fetchRecipes = useRecipesStore((s) => s.fetch);
  const router = useRouter();

  const handleDeleteCollection = (collection: Collection) => {
    const count = collection.recipeIds.length;
    const subtitle =
      count > 0
        ? `${count} ${count === 1 ? 'recipe' : 'recipes'} will stay saved — only the cookbook is removed.`
        : 'This cookbook is empty.';
    Alert.alert(`Delete “${collection.name}”?`, subtitle, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeCollection(collection.id).catch(() => {
            Alert.alert('Could not delete cookbook', 'Please try again.');
          });
        },
      },
    ]);
  };

  useEffect(() => {
    fetchCollections();
    fetchRecipes();
  }, [fetchCollections, fetchRecipes]);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);

  const sheetHeight = Dimensions.get('window').height;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  useEffect(() => {
    if (creating) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(sheetAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [creating, backdropAnim, sheetAnim]);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: sheetHeight, duration: 240, useNativeDriver: true }),
    ]).start(() => {
      setCreating(false);
      setName('');
      setPaletteIdx(0);
    });
  };

  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const palette = PALETTES[paletteIdx];
    try {
      const created = await createCollection({ name: trimmed, ...palette });
      closeModal();
      router.push(`/collection/${created.id}`);
    } catch {
      // keep modal open so the user can retry
    } finally {
      setSubmitting(false);
    }
  };

  // Split into rows of 2
  const rows: Collection[][] = [];
  for (let i = 0; i < collections.length; i += 2) {
    rows.push(collections.slice(i, i + 2));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>My cookbooks</Text>
            <Text style={styles.sub}>{collections.length} collections</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} activeOpacity={0.85} onPress={() => setCreating(true)}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((col) => (
              <BookCard
                key={col.id}
                collection={col}
                onPress={() => router.push(`/collection/${col.id}`)}
                onLongPress={() => handleDeleteCollection(col)}
              />
            ))}
            {/* Spacer when odd number of collections */}
            {row.length === 1 && <View style={styles.bookOuter} />}
          </View>
        ))}

        {collections.length > 0 && (
          <Text style={styles.cookbookHint}>
            Long-press a cookbook to delete it.
          </Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All recipes</Text>
          <Text style={styles.sectionSub}>
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </Text>
        </View>

        {recipes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Import a recipe to see it here.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
          >
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} width={180} />
            ))}
          </ScrollView>
        )}
      </ScrollView>
      <BottomFade />

      <Modal
        visible={creating}
        animationType="none"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          </Animated.View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            style={styles.sheetWrap}
            pointerEvents="box-none"
          >
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New cookbook</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sunday brunches"
              placeholderTextColor={colors.umber}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <Text style={styles.fieldLabel}>Cover</Text>
            <View style={styles.swatchRow}>
              {PALETTES.map((p, i) => {
                const selected = i === paletteIdx;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.85}
                    onPress={() => setPaletteIdx(i)}
                    style={[
                      styles.swatch,
                      { backgroundColor: p.coverColor },
                      selected && { borderColor: p.inkColor, borderWidth: 2 },
                    ]}
                  >
                    <View style={[styles.swatchSpine, { backgroundColor: p.spineColor }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={closeModal}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
                activeOpacity={0.85}
                onPress={handleCreate}
                disabled={!name.trim()}
              >
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const PAGE_INSET = 6; // how far pages peek below the book

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  content: { paddingBottom: 120 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl2,
  },
  title: { ...typeScale.h1, color: colors.espresso },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    marginTop: 2,
  },
  newBtn: {
    backgroundColor: colors.terra,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  newBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textOnDark,
  },

  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.xl2 + PAGE_INSET,
  },
  cookbookHint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    textAlign: 'center',
    marginTop: -spacing.md,
    marginBottom: spacing.xl2,
    paddingHorizontal: spacing.xl,
  },

  // Outer wrapper gives extra vertical room for peeking pages
  bookOuter: {
    flex: 1,
    height: BOOK_HEIGHT + PAGE_INSET * 2,
  },

  // Pages absolutely positioned at bottom, slightly offset right-to-left
  page: {
    position: 'absolute',
    borderRadius: radius.card,
    left: 0,
    right: 0,
    height: BOOK_HEIGHT,
  },
  pageFar: {
    bottom: 0,
    left: 10,
    right: -4,
  },
  pageMid: {
    bottom: PAGE_INSET * 0.6,
    left: 5,
    right: -2,
  },
  pageNear: {
    bottom: PAGE_INSET,
    left: 2,
    right: 0,
  },

  // Main book cover sits on top
  book: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BOOK_HEIGHT,
    borderRadius: radius.card,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: colors.espresso,
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  spine: {
    width: 14,
  },
  coverBody: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
  },
  countPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  countText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
  },

  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: 2,
  },
  sectionTitle: {
    ...typeScale.h2,
    color: colors.espresso,
  },
  sectionSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },
  hList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  emptyWrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },

  modalRoot: { flex: 1 },
  sheetWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(44,34,24,0.35)' },
  sheet: {
    backgroundColor: colors.oat,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl2,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderEmphasis,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typeScale.h2,
    color: colors.espresso,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.umber,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.espresso,
    borderWidth: 1,
    borderColor: colors.borderResting,
    marginBottom: spacing.lg,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  swatchSpine: {
    width: 8,
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderEmphasis,
  },
  cancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.terra,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textOnDark,
  },
});
