import { Platform } from 'react-native';

export const COLORS = {
  // Brand Ocean & Water
  primary: '#0751A8',
  primaryDark: '#043A7C',
  primaryLight: '#EBF5FF',
  primaryMuted: '#1E68C2',

  // Accent & Energy
  accent: '#00C2E9',
  accentDark: '#009BBF',
  accentLight: '#E0F7FE',

  // Canvas & Surfaces
  canvas: '#F5F9FD',
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',
  cardSubtle: '#F0F5FA',

  // Text & Typography
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverted: '#FFFFFF',

  // Borders & Dividers
  border: '#E8EFF7',
  borderStrong: '#CBD5E1',

  // Feedback
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
};

export const FONTS = {
  regular: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    ios: 'Inter_400Regular',
    android: 'Inter_400Regular',
  }),
  heading: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    ios: 'Inter_700Bold',
    android: 'Inter_700Bold',
  }),
};

export { fontFamilies, TYPOGRAPHY } from './theme/typography';

export const SHADOWS = {
  sm: {
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0751A8',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#0751A8',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
