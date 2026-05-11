import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import { usePlanStore, getMondayIso } from '@/store/plan';
import type { GroceryItem } from '@/types';

function currentWeekStartIso(): string {
  return getMondayIso();
}

function formatQty(item: GroceryItem): string {
  if (item.totalQuantity == null) return '';
  return item.unit ? `${item.totalQuantity} ${item.unit}` : String(item.totalQuantity);
}

export function GroceryPeek() {
  const weekStart = currentWeekStartIso();
  const items = usePlanStore((s) => s.groceryByWeek[weekStart] ?? []);
  const fetchGroceryList = usePlanStore((s) => s.fetchGroceryList);
  const toggle = usePlanStore((s) => s.toggleGroceryItem);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchGroceryList(weekStart).catch(() => {});
  }, [fetchGroceryList, weekStart]);

  const total = items.length;
  const doneCount = items.filter((i) => i.checked).length;
  const fillWidth = total > 0 ? Math.round((doneCount / total) * 48) : 0;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => total > 0 && setExpanded((e) => !e)}
        activeOpacity={total > 0 ? 0.8 : 1}
      >
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="format-list-checks" size={16} color={colors.sage} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Grocery list</Text>
          <Text style={styles.headerSub}>
            {total === 0
              ? 'Plan some meals to build your list'
              : `${doneCount} of ${total} items ticked off`}
          </Text>
        </View>
        {total > 0 && (
          <View style={styles.headerRight}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: fillWidth }]} />
            </View>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.umber}
            />
          </View>
        )}
      </TouchableOpacity>

      {expanded && total > 0 && (
        <View style={styles.list}>
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.item, i < items.length - 1 && styles.itemBorder]}
              onPress={() => toggle(item.id, weekStart)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                {item.checked && (
                  <MaterialCommunityIcons name="check" size={12} color={colors.textOnDark} />
                )}
              </View>
              <Text style={[styles.itemName, item.checked && styles.itemNameDone]}>
                {item.ingredientName}
              </Text>
              <Text style={styles.itemQty}>{formatQty(item)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.inner - 2,
    backgroundColor: colors.sagePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  headerSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.linen,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.sage,
  },
  list: {
    borderTopWidth: 0.5,
    borderTopColor: colors.borderResting,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  itemBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderResting,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.sage,
    borderWidth: 0,
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.espresso,
  },
  itemNameDone: {
    color: colors.umber,
    textDecorationLine: 'line-through',
  },
  itemQty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
});
