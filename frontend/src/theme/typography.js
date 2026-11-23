import { Platform } from 'react-native';

export const fontFamilies = {
  regular: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter_400Regular',
  }),
  medium: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter_500Medium',
  }),
  semiBold: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter_600SemiBold',
  }),
  bold: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter_700Bold',
  }),
  extraBold: Platform.select({
    web: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    default: 'Inter_800ExtraBold',
  }),
};

// On Android, avoid synthetic bolding when using explicit font family names.
// On iOS and Web, explicitly set fontWeight alongside fontFamily.
const getWeight = (weight) => (Platform.OS === 'android' ? {} : { fontWeight: weight });

export const TYPOGRAPHY = {
  // Main screen headings: 24–28px, font-weight 700
  h1: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
    ...getWeight('700'),
  },
  h2: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    ...getWeight('700'),
  },

  // Section headings: 18–20px, font-weight 600
  sectionTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.3,
    ...getWeight('600'),
  },

  // Card titles: 16px, font-weight 600
  cardTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    ...getWeight('600'),
  },

  // Body text: 14–16px, font-weight 400
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 22,
    ...getWeight('400'),
  },
  bodySmall: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
    ...getWeight('400'),
  },

  // Secondary descriptions: 12–14px, font-weight 400
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    ...getWeight('400'),
  },
  captionSmall: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
    ...getWeight('400'),
  },

  // Buttons: 15–16px, font-weight 600
  button: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.2,
    ...getWeight('600'),
  },
  buttonSmall: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
    ...getWeight('600'),
  },

  // Input labels: 14px, font-weight 500
  inputLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
    ...getWeight('500'),
  },

  // Input values and placeholders: 14–16px, font-weight 400
  inputValue: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 21,
    ...getWeight('400'),
  },

  // Prices and important amounts: 20–24px, font-weight 700
  price: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    ...getWeight('700'),
  },
  priceSmall: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    ...getWeight('700'),
  },

  // Navigation labels: 11–12px, font-weight 500
  navLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: -0.1,
    ...getWeight('500'),
  },
};

export default TYPOGRAPHY;
