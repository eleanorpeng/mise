import { useMemo } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, spacing, radius } from '@/constants';
import { useChefHistoryStore, type ChefConversationSummary } from '@/store/chefHistory';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function snippet(convo: ChefConversationSummary): string {
  if (convo.snippet?.trim()) {
    return convo.snippet.replace(/\s+/g, ' ').slice(0, 90);
  }
  return 'No messages yet';
}

export function ChefHistorySheet({ visible, onClose, onOpenConversation }: Props) {
  const insets = useSafeAreaInsets();
  const conversations = useChefHistoryStore((s) => s.conversations);
  const currentId = useChefHistoryStore((s) => s.currentId);
  const remove = useChefHistoryStore((s) => s.remove);

  const ordered = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const ax = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const bx = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        return bx - ax;
      }),
    [conversations],
  );

  const confirmDelete = (convo: ChefConversationSummary) => {
    Alert.alert(
      'Delete chat?',
      convo.title,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(convo.id) },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? spacing.sm : insets.top }]}>
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Past chats</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
              <MaterialCommunityIcons name="close" size={20} color={colors.espresso} />
            </TouchableOpacity>
          </View>
        </View>

        {ordered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No past chats yet. Start asking the chef.</Text>
          </View>
        ) : (
          <FlatList
            data={ordered}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isCurrent = item.id === currentId;
              return (
                <Pressable
                  onPress={() => onOpenConversation(item.id)}
                  onLongPress={() => confirmDelete(item)}
                  delayLongPress={400}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.7 },
                    isCurrent && styles.rowCurrent,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowSnippet} numberOfLines={2}>
                      {snippet(item)}
                    </Text>
                  </View>
                  <Text style={styles.rowTime}>{relativeTime(item.updatedAt)}</Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.oat,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderEmphasis,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.espresso,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    textAlign: 'center',
  },
  separator: { height: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  rowCurrent: {
    borderColor: colors.terra,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  rowSnippet: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.umber,
  },
  rowTime: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.umber,
    marginTop: 2,
  },
});
