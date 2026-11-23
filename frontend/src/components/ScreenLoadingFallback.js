import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

const SCREEN_TITLES = {
  home: 'Home Page',
  services: 'Our Services',
  booking: 'Tanker Booking',
  'my-bookings': 'Your Bookings',
  tracking: 'Live Water Tracking',
  'vendor-tracking': 'Driver Navigation',
  support: 'Help & Support',
  'user-portal': 'User Profile',
  'my-profile': 'Profile & Account',
  'vendor-portal': 'Vendor Portal',
  login: 'Sign In',
  signup: 'Create Account',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
};

export default function ScreenLoadingFallback({ screenName = 'page' }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Pulse animation for the central badge
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Shimmer opacity animation for skeleton placeholders
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  const friendlyTitle = SCREEN_TITLES[screenName] || 'Next Page';

  return (
    <View style={styles.container}>
      <View style={styles.contentWrap}>
        {/* Animated Ripple Water Badge */}
        <Animated.View style={[styles.outerBadge, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.innerBadge}>
            <Ionicons name="water" size={32} color="#0751A8" />
          </View>
        </Animated.View>

        {/* Loading Labels */}
        <Text style={styles.loadingTitle}>Loading {friendlyTitle}...</Text>
        <Text style={styles.loadingSubtitle}>
          Fetching latest details and preparing your view
        </Text>

        {/* Themed Skeleton Card Placeholders */}
        <View style={styles.skeletonContainer}>
          <Animated.View style={[styles.skeletonHeaderBar, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.skeletonLineLong, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.skeletonLineShort, { opacity: shimmerAnim }]} />

          <View style={styles.skeletonGridRow}>
            <Animated.View style={[styles.skeletonGridBox, { opacity: shimmerAnim }]} />
            <Animated.View style={[styles.skeletonGridBox, { opacity: shimmerAnim }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F9',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  outerBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EBF5FF',
    borderWidth: 3,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  innerBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  loadingTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 290,
  },
  skeletonContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  skeletonHeaderBar: {
    width: '55%',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
    marginBottom: 2,
  },
  skeletonLineLong: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  skeletonLineShort: {
    width: '75%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  skeletonGridRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  skeletonGridBox: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
});
