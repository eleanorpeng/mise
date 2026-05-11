import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants';

interface Props {
  /** Total fade height. Defaults to 140 — enough to cover the floating tab bar. */
  height?: number;
}

/**
 * Soft fade overlay that sits at the bottom of a scrollable screen, easing
 * scroll content into the screen background so it doesn't visually clip
 * against the floating tab bar. Use under the tab bar, not above it.
 */
export function BottomFade({ height = 140 }: Props) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[
        'rgba(245,239,224,0)',
        'rgba(245,239,224,0.7)',
        colors.oat,
      ]}
      locations={[0, 0.55, 1]}
      style={[styles.fade, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
