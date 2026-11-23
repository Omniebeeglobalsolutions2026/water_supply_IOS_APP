import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    // 1. Subtle pulse loop on the glowing rings
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1000,
          useNativeDriver: useNative,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: useNative,
        }),
      ])
    );
    pulseLoop.start();

    // 2. Keep splash visible for 2.4 seconds then exit smoothly
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: useNative,
      }).start(() => {
        pulseLoop.stop();
        if (onFinish) onFinish();
      });
    }, 2400);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
    };
  }, []);

  return (
    <View style={styles.splashRoot}>
      <StatusBar barStyle="light-content" backgroundColor="#0751A8" />

      {/* Background Water Wave Glow Circles */}
      <View style={styles.ambientGlowTop} />
      <View style={styles.ambientGlowBottom} />

      <Animated.View
        style={[
          styles.contentWrap,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Glowing Logo Container */}
        <Animated.View
          style={[
            styles.logoOuterGlow,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.logoMidRing}>
            <View style={styles.logoWhiteCircle}>
              <Image
                source={require('../../assets/bhagira_logo_brand.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Animated.View>

        {/* Brand Name & Tagline */}
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandName}>BHAGIRA</Text>
          <View style={styles.taglineRow}>
            <Ionicons name="water" size={14} color="#7DD3FC" style={{ marginRight: 6 }} />
            <Text style={styles.brandTagline}>Clean Water at Your Doorstep</Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Certifications & Version Info */}
      <Animated.View style={[styles.bottomFooter, { opacity: fadeAnim }]}>
        <View style={styles.badgeRow}>
          <Ionicons name="shield-checkmark" size={13} color="#93C5FD" style={{ marginRight: 5 }} />
          <Text style={styles.footerText}>100% Certified Water Supply</Text>
        </View>
        <Text style={styles.versionText}>v1.0.0 · Fast Doorstep Delivery</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? '100vh' : '100%',
    backgroundColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#0EA5E9',
    opacity: 0.25,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#0284C7',
    opacity: 0.35,
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: 24,
  },
  logoOuterGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#00A3FF',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoMidRing: {
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWhiteCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logoImage: {
    width: 74,
    height: 74,
  },
  brandTextWrap: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    paddingHorizontal: 20,
  },
  brandName: {
    ...TYPOGRAPHY.h1,
    fontSize: 28,
    fontFamily: fontFamilies.bold,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  brandTagline: {
    ...TYPOGRAPHY.caption,
    fontSize: 14,
    fontWeight: '600',
    color: '#BAE6FD',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  loaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  bottomFooter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 28,
    alignItems: 'center',
    zIndex: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#E0F2FE',
    letterSpacing: 0.3,
  },
  versionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10.5,
    color: '#93C5FD',
    opacity: 0.8,
  },
});
