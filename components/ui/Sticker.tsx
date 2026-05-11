import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Halo thickness as a scale factor. 1.06 ≈ subtle, 1.12 ≈ chunky die-cut. */
  borderScale?: number;
};

// expo-image: SDWebImage / Coil under the hood ⇒ memory + disk cache, off-main-thread decode.
// Two-layer halo: scaled white-tint backdrop + original on top. Half the image views of the
// 4-direction stack; visually almost identical and dramatically faster to load with many stickers.
export function Sticker({ uri, style, borderScale = 1.08 }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFillObject, styles.halo, { transform: [{ scale: borderScale }] }]}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={120}
      />
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'visible' },
  halo: { tintColor: '#FFFFFF' },
});
