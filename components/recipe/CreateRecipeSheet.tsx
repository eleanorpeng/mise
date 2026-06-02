import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface OptionRow {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  caption: string;
  onPress: () => void;
}

export function CreateRecipeSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheetHeight = Dimensions.get('window').height;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  useEffect(() => {
    if (visible) {
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
  }, [visible, backdropAnim, sheetAnim]);

  const handleClose = (afterClose?: () => void) => {
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
      onClose();
      afterClose?.();
    });
  };

  const options: OptionRow[] = [
    {
      icon: 'pencil-outline',
      title: 'Write it yourself',
      caption: 'Type in ingredients and steps',
      onPress: () => handleClose(() => router.push('/recipe/new')),
    },
    {
      icon: 'link-variant',
      title: 'Paste a link',
      caption: 'TikTok or Reels video',
      onPress: () => handleClose(() => router.push('/import?mode=url')),
    },
    {
      icon: 'camera-outline',
      title: 'Upload a photo',
      caption: 'Of a finished dish',
      onPress: () => handleClose(() => router.push('/import?mode=photo')),
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={() => handleClose()}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => handleClose()} />
        </Animated.View>

        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: spacing.xl2 + insets.bottom, transform: [{ translateY: sheetAnim }] },
            ]}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>New recipe</Text>
            <Text style={styles.subtitle}>Start from scratch, or import.</Text>

            <View style={styles.optionList}>
              {options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.row}
                  activeOpacity={0.85}
                  onPress={opt.onPress}
                >
                  <View style={styles.iconBubble}>
                    <MaterialCommunityIcons name={opt.icon} size={22} color={colors.terra} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{opt.title}</Text>
                    <Text style={styles.rowCaption}>{opt.caption}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.umber} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
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
  optionList: {
    gap: spacing.sm,
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
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.espresso,
  },
  rowCaption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
    marginTop: 2,
  },
});
