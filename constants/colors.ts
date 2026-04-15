export const colors = {
  // Neutrals
  oat: '#F5EFE0',
  linen: '#EDE4CE',
  sand: '#DDD0B3',
  umber: '#9A826A',
  espresso: '#2C2218',

  // Terracotta ramp
  blush: '#F5D0BC',
  ember: '#E87A4A',
  terra: '#D4521C',
  rust: '#A83E10',
  brick: '#6C250A',

  // Accents
  sagePale: '#D8EACE',
  sage: '#7A9E6A',
  butterPale: '#FBF0CC',
  butter: '#F0C96A',
  peach: '#E8A87C',

  // Semantic
  cardBg: '#FFFFFF',
  textOnDark: '#FAE8DA',
  borderResting: 'rgba(92,74,54,0.15)',
  borderEmphasis: 'rgba(92,74,54,0.22)',
} as const;

export type ColorToken = keyof typeof colors;
