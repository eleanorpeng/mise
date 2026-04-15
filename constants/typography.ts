import type { TextStyle } from 'react-native';

export const fonts = {
  display: 'DMSerifDisplay_400Regular',
  bodyRegular: 'Urbanist_400Regular',
  bodyMedium: 'Urbanist_500Medium',
} as const;

export const typeScale = {
  display: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.4,
  } as TextStyle,
  h1: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.2,
  } as TextStyle,
  h2: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.2,
  } as TextStyle,
  cardTitle: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 16,
    lineHeight: 21,
  } as TextStyle,
  bodyLg: {
    fontFamily: 'Urbanist_400Regular',
    fontSize: 17,
    lineHeight: 26,
  } as TextStyle,
  body: {
    fontFamily: 'Urbanist_400Regular',
    fontSize: 16,
    lineHeight: 24,
  } as TextStyle,
  ui: {
    fontFamily: 'Urbanist_500Medium',
    fontSize: 16,
  } as TextStyle,
  caption: {
    fontFamily: 'Urbanist_400Regular',
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  label: {
    fontFamily: 'Urbanist_500Medium',
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;
