import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { useCollectionsStore, type Collection } from '@/store/collections';

const PALETTES: Array<Pick<Collection, 'coverColor' | 'spineColor' | 'inkColor'>> = [
  { coverColor: '#F5D0BC', spineColor: '#E8A87C', inkColor: '#6C250A' },
  { coverColor: '#D8EACE', spineColor: '#7A9E6A', inkColor: '#3A5C2A' },
  { coverColor: '#FBF0CC', spineColor: '#F0C96A', inkColor: '#7A5C10' },
  { coverColor: '#EDE4CE', spineColor: '#DDD0B3', inkColor: '#9A826A' },
  { coverColor: '#E8A87C', spineColor: '#D4521C', inkColor: '#2C2218' },
  { coverColor: '#C9D8E0', spineColor: '#7A95A4', inkColor: '#28404A' },
];

interface Props {
  visible: boolean;
  recipeId: string;
  onClose: () => void;
}

export function AddToCollectionSheet({ visible, recipeId, onClose }: Props) {
  const collections = useCollectionsStore((s) => s.collections);
  const fetchCollections = useCollectionsStore((s) => s.fetch);
  const createCollection = useCollectionsStore((s) => s.create);
  const addRecipe = useCollectionsStore((s) => s.addRecipe);
  const removeRecipe = useCollectionsStore((s) => s.removeRecipe);

  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [newName, setNewName] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const sheetHeight = Dimensions.get('window').height;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  useEffect(() => {
    if (visible) {
      fetchCollections();
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(sheetAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropAnim, sheetAnim, fetchCollections]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: sheetHeight,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMode('list');
      setNewName('');
      setPaletteIdx(0);
      onClose();
    });
  };

  const handleToggle = async (col: Collection) => {
    if (busy) return;
    setBusy(col.id);
    try {
      if (col.recipeIds.includes(recipeId)) {
        await removeRecipe(col.id, recipeId);
      } else {
        await addRecipe(col.id, recipeId);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || busy) return;
    setBusy('new');
    try {
      const palette = PALETTES[paletteIdx];
      const created = await createCollection({ name: trimmed, ...palette });
      await addRecipe(created.id, recipeId);
      setMode('list');
      setNewName('');
      setPaletteIdx(0);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <View style={styles.handle} />

            {mode === 'list' ? (
              <>
                <Text style={styles.title}>Add to cookbook</Text>
                <Text style={styles.subtitle}>
                  Tap a cookbook to add or remove this recipe.
                </Text>

                <ScrollView
                  style={styles.list}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                >
                  {collections.length === 0 && (
                    <Text style={styles.emptyText}>
                      No cookbooks yet. Create your first one below.
                    </Text>
                  )}

                  {collections.map((c) => {
                    const checked = c.recipeIds.includes(recipeId);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.row}
                        activeOpacity={0.85}
                        onPress={() => handleToggle(c)}
                        disabled={busy !== null}
                      >
                        <View
                          style={[
                            styles.swatch,
                            { backgroundColor: c.coverColor },
                          ]}
                        >
                          <View
                            style={[
                              styles.swatchSpine,
                              { backgroundColor: c.spineColor },
                            ]}
                          />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowName}>{c.name}</Text>
                          <Text style={styles.rowMeta}>
                            {c.recipeIds.length}{' '}
                            {c.recipeIds.length === 1 ? 'recipe' : 'recipes'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            checked && styles.checkboxOn,
                          ]}
                        >
                          {checked && (
                            <MaterialCommunityIcons
                              name="check"
                              size={14}
                              color={colors.textOnDark}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={styles.newCookbook}
                  onPress={() => setMode('create')}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={18}
                    color={colors.terra}
                  />
                  <Text style={styles.newCookbookText}>New cookbook</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.createHeader}>
                  <TouchableOpacity
                    onPress={() => setMode('list')}
                    hitSlop={12}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={22}
                      color={colors.espresso}
                    />
                  </TouchableOpacity>
                  <Text style={styles.title}>New cookbook</Text>
                  <View style={{ width: 22 }} />
                </View>

                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
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
                          styles.bigSwatch,
                          { backgroundColor: p.coverColor },
                          selected && {
                            borderColor: p.inkColor,
                            borderWidth: 2,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.bigSwatchSpine,
                            { backgroundColor: p.spineColor },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    activeOpacity={0.85}
                    onPress={() => setMode('list')}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createBtn,
                      (!newName.trim() || busy === 'new') &&
                        styles.createBtnDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={handleCreate}
                    disabled={!newName.trim() || busy === 'new'}
                  >
                    <Text style={styles.createText}>
                      {busy === 'new' ? 'Creating…' : 'Create & add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  sheetWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44,34,24,0.35)',
  },
  sheet: {
    backgroundColor: colors.oat,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl2,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderEmphasis,
    marginBottom: spacing.lg,
  },
  title: {
    ...typeScale.h2,
    color: colors.espresso,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    marginBottom: spacing.lg,
  },
  list: { maxHeight: 320 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.md },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  swatch: {
    width: 40,
    height: 50,
    borderRadius: radius.input,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  swatchSpine: {
    width: 6,
    height: '100%',
  },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.espresso,
  },
  rowMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.terra,
    borderColor: colors.terra,
  },
  newCookbook: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderEmphasis,
    backgroundColor: 'transparent',
  },
  newCookbookText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.terra,
  },

  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.linen,
    borderRadius: radius.inner,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
    borderWidth: 0.5,
    borderColor: colors.sand,
    marginBottom: spacing.lg,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  bigSwatch: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bigSwatchSpine: {
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
  createBtnDisabled: { opacity: 0.4 },
  createText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textOnDark,
  },
});
