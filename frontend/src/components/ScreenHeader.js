import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY } from '../theme/typography';

export default function ScreenHeader({
  label,
  title,
  onMenuPress,
  onAvatarPress,
  isLoggedIn,
  currentUser,
  userInitial,
  onBackPress,
  locationMode = false,
  locationTitle = 'Delivery Location',
  locationAddress,
  onLocationPress,
}) {
  const initial = userInitial
    || (currentUser?.name ? currentUser.name.trim().charAt(0).toUpperCase() : '')
    || (currentUser?.businessName ? currentUser.businessName.trim().charAt(0).toUpperCase() : '')
    || (isLoggedIn ? 'R' : 'G');

  const handleAvatarPress = onAvatarPress || onMenuPress;

  if (locationMode) {
    return (
      <View style={styles.locationHeaderContainer}>
        {/* Top Logo & Actions Bar */}
        <View style={styles.topLogoBar}>
          <View style={styles.logoGroup}>
            <View style={styles.logoBadgeWrap}>
              <Image
                source={require('../../assets/bhagira_logo_brand.png')}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <View style={styles.topActionsGroup}>
            <Pressable style={styles.iconCircleButton} onPress={handleAvatarPress}>
              <Ionicons name="notifications-outline" size={19} color="#0F172A" />
              <View style={styles.notifDot} />
            </Pressable>
            <Pressable style={styles.avatarButton} onPress={handleAvatarPress}>
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        {/* Floating Delivery Location Card */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select delivery location"
          onPress={onLocationPress}
          style={styles.deliveryLocationCard}
        >
          <View style={styles.locationPinCircle}>
            <Ionicons name="location" size={18} color="#0751A8" />
          </View>
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationCardTitle}>{locationTitle || 'Delivery Location'}</Text>
            <Text style={styles.locationCardAddress} numberOfLines={1}>
              {locationAddress || 'Tap to select delivery location'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#64748B" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.headerRow}>
      <View style={styles.leftGroup}>
        {onBackPress ? (
          <Pressable style={styles.backButton} onPress={onBackPress}>
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </Pressable>
        ) : null}

        <View style={styles.headerCenter}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      <Pressable
        style={styles.avatarButton}
        onPress={handleAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  locationHeaderContainer: {
    width: '100%',
    marginBottom: 16,
  },
  topLogoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 12,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadgeWrap: {
    width: 80,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  brandLogoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 22,
    color: '#0751A8',
  },
  topActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EFF7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#0751A8',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  deliveryLocationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0751A8',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  locationPinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  locationCardTitle: {
    ...TYPOGRAPHY.navLabel,
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  locationCardAddress: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 13,
    color: '#0F172A',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  headerCenter: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: '#0F172A',
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F7FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    flexShrink: 0,
  },
  avatarText: {
    ...TYPOGRAPHY.cardTitle,
    color: '#0751A8',
  },
});
