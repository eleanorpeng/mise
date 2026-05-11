import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  Pressable,
  Keyboard,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRef } from "react";
import { colors, fonts, typeScale, spacing, radius } from "@/constants";
import type { GroceryItem } from "@/types";
import { usePlanStore } from "@/store/plan";
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABEL,
  inferGroceryCategory,
  type GroceryCategory,
} from "@/lib/groceryCategory";

interface Props {
  weekStart: string;
}

const CATEGORY_ORDER: string[] = GROCERY_CATEGORIES;
const CATEGORY_LABEL: Record<string, string> = GROCERY_CATEGORY_LABEL;

export function GroceryListView({ weekStart }: Props) {
  const items = usePlanStore((s) => s.groceryByWeek[weekStart] ?? []);
  const fetchGroceryList = usePlanStore((s) => s.fetchGroceryList);
  const toggleItem = usePlanStore((s) => s.toggleGroceryItem);
  const removeItem = usePlanStore((s) => s.removeGroceryItem);
  const updateItem = usePlanStore((s) => s.updateGroceryItem);
  const addItem = usePlanStore((s) => s.addGroceryItem);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<GroceryCategory | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);

  const inferredCategory = inferGroceryCategory(newName);
  const effectiveCategory: GroceryCategory =
    categoryTouched && newCategory ? newCategory : inferredCategory;

  useEffect(() => {
    fetchGroceryList(weekStart).catch(() => {});
  }, [fetchGroceryList, weekStart]);

  // Close the add row whenever the keyboard hides (tap outside, drag, hardware dismiss).
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (adding) {
        handleAddNew(false);
      }
    });
    return () => sub.remove();
    // handleAddNew closes over newName/effectiveCategory; recreating effect each render is fine.
  });

  const grouped = useMemo(() => {
    const map = new Map<string, GroceryItem[]>();
    for (const it of items) {
      const cat = it.category || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]);
      const bi = CATEGORY_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [items]);

  const total = items.length;
  const done = items.filter((i) => i.checked).length;

  const handleStartEdit = (it: GroceryItem) => {
    setEditingId(it.id);
    setDraftName(it.ingredientName);
  };

  const handleCommitEdit = (it: GroceryItem) => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== it.ingredientName) {
      updateItem(it.id, weekStart, { ingredientName: trimmed });
    }
    setEditingId(null);
  };

  const handleAddNew = (keepOpen = false) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      if (!keepOpen) {
        setAdding(false);
        setNewCategory(null);
        setCategoryTouched(false);
      }
      return;
    }
    addItem({
      weekStart,
      ingredientName: trimmed,
      category: effectiveCategory,
    }).catch(() => {});
    setNewName("");
    setNewCategory(null);
    setCategoryTouched(false);
    if (!keepOpen) setAdding(false);
  };

  const dismissInput = () => {
    if (adding) {
      Keyboard.dismiss();
      handleAddNew(false);
    } else {
      Keyboard.dismiss();
    }
  };

  if (total === 0) {
    return (
      <Pressable style={styles.emptyOuter} onPress={dismissInput}>
      <View style={styles.empty}>
        <MaterialCommunityIcons
          name="basket-outline"
          size={28}
          color={colors.umber}
          style={{ opacity: 0.6 }}
        />
        <Text style={styles.emptyTitle}>No grocery items yet</Text>
        <Text style={styles.emptyBody}>
          Plan a few meals and we'll build a list for you.
        </Text>
        <TouchableOpacity
          onPress={() => setAdding(true)}
          activeOpacity={0.85}
          style={styles.emptyAdd}
        >
          <MaterialCommunityIcons name="plus" size={16} color={colors.terra} />
          <Text style={styles.emptyAddText}>Add an item manually</Text>
        </TouchableOpacity>

        {adding && (
          <View style={styles.addBlock}>
            <View style={styles.addRow}>
              <TextInput
                autoFocus
                placeholder="e.g. Pasta"
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={() => handleAddNew(true)}
                blurOnSubmit={false}
                returnKeyType="done"
                style={styles.addInput}
                placeholderTextColor={colors.umber}
              />
              <TouchableOpacity
                onPress={() => handleAddNew(true)}
                disabled={!newName.trim()}
                activeOpacity={0.85}
                style={[styles.addSubmit, !newName.trim() && styles.addSubmitDisabled]}
              >
                <MaterialCommunityIcons name="plus" size={18} color={colors.textOnDark} />
              </TouchableOpacity>
            </View>
            <CategoryPicker
              value={effectiveCategory}
              onChange={(c) => {
                setNewCategory(c);
                setCategoryTouched(true);
              }}
            />
          </View>
        )}
      </View>
      </Pressable>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, styles.contentGrow]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.summary}>
        <Text style={styles.summaryHead}>
          {done} of {total}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: total ? `${(done / total) * 100}%` : 0 },
            ]}
          />
        </View>
      </View>

      {grouped.map(([cat, list]) => (
        <View key={cat} style={styles.section}>
          <Text style={styles.sectionLabel}>{CATEGORY_LABEL[cat] ?? cat}</Text>
          {list.map((it) => (
            <SwipeRow key={it.id} onDelete={() => removeItem(it.id, weekStart)}>
              <TouchableOpacity
                onPress={() => toggleItem(it.id, weekStart)}
                onLongPress={() => handleStartEdit(it)}
                activeOpacity={0.85}
                style={styles.row}
              >
                <View
                  style={[styles.checkbox, it.checked && styles.checkboxOn]}
                >
                  {it.checked && (
                    <MaterialCommunityIcons
                      name="check"
                      size={13}
                      color={colors.textOnDark}
                    />
                  )}
                </View>

                {editingId === it.id ? (
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    autoFocus
                    onBlur={() => handleCommitEdit(it)}
                    onSubmitEditing={() => handleCommitEdit(it)}
                    style={[styles.itemInput, it.checked && styles.itemDone]}
                  />
                ) : (
                  <Text
                    style={[styles.itemName, it.checked && styles.itemDone]}
                  >
                    {it.ingredientName}
                  </Text>
                )}

                {it.totalQuantity != null && (
                  <Text style={styles.qty}>
                    {it.totalQuantity}
                    {it.unit ? ` ${it.unit}` : ""}
                  </Text>
                )}
              </TouchableOpacity>
            </SwipeRow>
          ))}
        </View>
      ))}

      {adding ? (
        <View style={styles.addBlock}>
          <View style={styles.addRow}>
            <TextInput
              autoFocus
              placeholder="Add an item"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={() => handleAddNew(true)}
              blurOnSubmit={false}
              returnKeyType="done"
              style={styles.addInput}
              placeholderTextColor={colors.umber}
            />
            <TouchableOpacity
              onPress={() => handleAddNew(true)}
              disabled={!newName.trim()}
              activeOpacity={0.85}
              style={[styles.addSubmit, !newName.trim() && styles.addSubmitDisabled]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.textOnDark} />
            </TouchableOpacity>
          </View>
          <CategoryPicker
            value={effectiveCategory}
            onChange={(c) => {
              setNewCategory(c);
              setCategoryTouched(true);
            }}
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setAdding(true)}
          activeOpacity={0.85}
          style={styles.addBtn}
        >
          <MaterialCommunityIcons name="plus" size={16} color={colors.terra} />
          <Text style={styles.addBtnText}>Add item</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: GroceryCategory;
  onChange: (c: GroceryCategory) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.catRow}
    >
      {GROCERY_CATEGORIES.map((c) => {
        const active = value === c;
        return (
          <TouchableOpacity
            key={c}
            onPress={() => onChange(c)}
            activeOpacity={0.85}
            style={[styles.catChip, active && styles.catChipActive]}
          >
            <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
              {GROCERY_CATEGORY_LABEL[c]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SwipeRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) tx.setValue(Math.max(g.dx, -160));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -84) {
          Animated.timing(tx, {
            toValue: -400,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
          Animated.spring(tx, {
            toValue: 0,
            useNativeDriver: true,
            speed: 18,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.swipeOuter}>
      <View style={styles.swipeBg}>
        <MaterialCommunityIcons
          name="trash-can-outline"
          size={18}
          color={colors.textOnDark}
        />
      </View>
      <Animated.View
        style={[styles.swipeWrap, { transform: [{ translateX: tx }] }]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 140,
  },

  summary: {
    paddingVertical: spacing.md,
    gap: 8,
  },
  summaryHead: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.linen,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.sage,
  },

  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.umber,
    marginBottom: spacing.sm,
  },

  swipeOuter: {
    borderRadius: radius.inner,
    overflow: "hidden",
    marginBottom: 6,
  },
  swipeBg: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    backgroundColor: colors.rust,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: spacing.lg,
    borderRadius: radius.inner,
  },
  swipeWrap: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.sage,
    borderColor: colors.sage,
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  itemInput: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
    padding: 0,
  },
  itemDone: {
    color: colors.umber,
    textDecorationLine: "line-through",
  },
  qty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: spacing.sm,
  },
  addBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.terra,
  },
  addRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: radius.inner,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  addInput: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
    paddingVertical: 6,
  },
  addSubmit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubmitDisabled: {
    backgroundColor: colors.sand,
  },

  emptyOuter: { flex: 1 },

  contentGrow: { flexGrow: 1 },
  addBlock: { gap: spacing.sm },
  catRow: {
    paddingVertical: 4,
    paddingRight: spacing.xl,
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    backgroundColor: colors.cardBg,
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: colors.terra,
    borderColor: colors.terra,
  },
  catChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.umber,
  },
  catChipTextActive: {
    color: colors.textOnDark,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl2,
    gap: 8,
  },
  emptyTitle: {
    ...typeScale.h2,
    color: colors.espresso,
    marginTop: spacing.md,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    textAlign: "center",
    maxWidth: 260,
  },
  emptyAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: "rgba(212,82,28,0.08)",
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginTop: spacing.md,
  },
  emptyAddText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.terra,
  },
});
