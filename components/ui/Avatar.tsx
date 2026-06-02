import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts } from '@/constants';

interface AvatarProps {
  initials: string;
  imageUrl?: string | null;
  size?: number;
  onPress?: () => void;
}

export function Avatar({ initials, imageUrl, size = 34, onPress }: AvatarProps) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.container, dimensions]} />
      ) : (
        <View style={[styles.container, dimensions]}>
          <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>
            {initials.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
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
