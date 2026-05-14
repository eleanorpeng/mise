import { useState } from 'react';
import {
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Canvas,
  Image as SkImage,
  useImage,
  Morphology,
  ColorMatrix,
  Shadow,
} from '@shopify/react-native-skia';

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Outline thickness in pixels of canvas space. ~3–6 looks like iOS stickers. */
  outlineRadius?: number;
  /** Render a drop shadow beneath the cutout. Default true. */
  shadow?: boolean;
};

// Skia ColorMatrix that maps any colored pixel to opaque white while preserving
// alpha. Each row is [r, g, b, a, offset] for one output channel; setting RGB =
// alpha (premultiplied) gives clean opaque white wherever the source has alpha.
const WHITE_TINT = [
  0, 0, 0, 1, 0,
  0, 0, 0, 1, 0,
  0, 0, 0, 1, 0,
  0, 0, 0, 1, 0,
];

// iOS "lift subject" sticker effect, rendered live by Skia (same engine iOS
// uses internally). We render the cutout three times in one Canvas:
//   1. shadow-only pass with DropShadow filter
//   2. dilated alpha tinted white → uniform outline
//   3. original cutout on top
// Because the outline comes from Morphology operating on the alpha channel
// (not a tint of the feathered cutout), the result is crisp regardless of how
// soft rembg's mask edges are.
export function Sticker({
  uri,
  style,
  outlineRadius = 4,
  shadow = true,
}: Props) {
  const image = useImage(uri);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  return (
    <View style={style} onLayout={onLayout} pointerEvents="none">
      {image && size.width > 0 && size.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFillObject}>
          {shadow ? (
            <SkImage
              image={image}
              fit="contain"
              x={0}
              y={0}
              width={size.width}
              height={size.height}
            >
              <Shadow
                dx={0}
                dy={5}
                blur={6}
                color="rgba(0,0,0,0.28)"
                shadowOnly
              />
            </SkImage>
          ) : null}

          <SkImage
            image={image}
            fit="contain"
            x={0}
            y={0}
            width={size.width}
            height={size.height}
          >
            <Morphology operator="dilate" radius={outlineRadius} />
            <ColorMatrix matrix={WHITE_TINT} />
          </SkImage>

          <SkImage
            image={image}
            fit="contain"
            x={0}
            y={0}
            width={size.width}
            height={size.height}
          />
        </Canvas>
      ) : null}
    </View>
  );
}
