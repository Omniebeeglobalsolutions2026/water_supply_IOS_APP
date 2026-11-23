import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PullToRefreshScrollView from '../components/PullToRefreshScrollView';
import { triggerHaptic } from '../utils/mobileNotifications';
import { TYPOGRAPHY } from '../theme/typography';

export default function ServicesScreen({ setActiveScreen, isLoggedIn, currentUser, onOpenMenu, onBackPress }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    triggerHaptic('medium');
    await new Promise((r) => setTimeout(r, 600));
    setIsRefreshing(false);
    triggerHaptic('light');
  };

  return (
    <View style={styles.screenShell}>
      <PullToRefreshScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshMessage="Checking latest service updates..."
      >
        <ScreenHeader
          label="Clean water, delivered"
          title="Our services"
          onMenuPress={onOpenMenu}
          onAvatarPress={onOpenMenu}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onBackPress={onBackPress}
        />

        {/* Coming Soon Card matching the application theme & layout */}
        <View style={styles.card}>
          <View style={styles.comingSoonBadge}>
            <Ionicons name="sparkles" size={12} color="#0751A8" style={{ marginRight: 5 }} />
            <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
          </View>

          <View style={styles.iconBadgeOuter}>
            <View style={styles.iconBadgeInner}>
              <Ionicons name="water" size={38} color="#0751A8" />
            </View>
          </View>

          <Text style={styles.title}>Services Coming Soon</Text>
          <Text style={styles.subtitle}>
            We are working on bringing you new specialized water supply services. Stay tuned for exciting additions to your area!
          </Text>

          {setActiveScreen ? (
            <Pressable
              style={styles.primaryButton}
              onPress={() => setActiveScreen('home')}
            >
              <Ionicons name="home" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Back to Home</Text>
            </Pressable>
          ) : null}
        </View>
      </PullToRefreshScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#EDF3F9',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 520,
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 135,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    marginBottom: 18,
  },
  comingSoonBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#0751A8',
    letterSpacing: 0.8,
  },
  iconBadgeOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EBF5FF',
    borderWidth: 4,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconBadgeInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    shadowColor: '#0751A8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0751A8',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 14,
    shadowColor: '#0751A8',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
