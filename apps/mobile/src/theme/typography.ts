import { Platform } from 'react-native';

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export const Typography = {
  headingLarge: {
    fontFamily: serifFont,
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  headingSection: {
    fontFamily: serifFont,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  bodyPrimary: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  bodySecondary: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 10,
    fontWeight: '400' as const,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  metricHero: {
    fontSize: 36,
    fontWeight: '700' as const,
    letterSpacing: -1.2,
  },
} as const;
