import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { colors, fonts } from '@/constants';

const PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: colors.terra, fg: colors.textOnDark },
  { bg: colors.ember, fg: colors.brick },
  { bg: colors.peach, fg: colors.brick },
  { bg: colors.sand, fg: colors.espresso },
  { bg: colors.butter, fg: colors.brick },
  { bg: colors.sage, fg: colors.textOnDark },
  { bg: colors.blush, fg: colors.brick },
  { bg: colors.umber, fg: colors.textOnDark },
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialFor(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '·';
  const m = trimmed.match(/[A-Za-z0-9]/);
  return (m ? m[0] : trimmed[0]).toUpperCase();
}

interface Props {
  recipe: { id: string; title: string; coverImageUrl?: string | null };
  style?: StyleProp<ImageStyle>;
  letterSize?: number;
}

export function RecipeCover({ recipe, style, letterSize = 72 }: Props) {
  if (recipe.coverImageUrl) {
    return <Image source={{ uri: recipe.coverImageUrl }} style={style} />;
  }
  const { bg, fg } = PALETTE[hash(recipe.id) % PALETTE.length];
  return (
    <View style={[styles.placeholder, style, { backgroundColor: bg }]}>
      <Text
        style={[
          styles.letter,
          { color: fg, fontSize: letterSize, lineHeight: letterSize * 1.05 },
        ]}
        allowFontScaling={false}
      >
        {initialFor(recipe.title)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: fonts.display,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
