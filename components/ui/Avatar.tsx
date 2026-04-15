import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts } from '@/constants';

interface AvatarProps {
  initials: string;
  size?: number;
  onPress?: () => void;
}

export function Avatar({ initials, size = 34, onPress }: AvatarProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fonts.bodyMedium,
    color: colors.textOnDark,
  },
});
