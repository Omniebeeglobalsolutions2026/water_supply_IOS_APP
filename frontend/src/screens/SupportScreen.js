import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PullToRefreshScrollView from '../components/PullToRefreshScrollView';
import { triggerHaptic } from '../utils/mobileNotifications';
import { TYPOGRAPHY } from '../theme/typography';

export default function SupportScreen({ setActiveScreen, isLoggedIn, onOpenMenu, onBackPress }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    triggerHaptic('medium');
    await new Promise((r) => setTimeout(r, 600));
    setIsRefreshing(false);
    triggerHaptic('light');
  };

  const handleCall = () => {
    Linking.openURL('tel:+919347557729').catch(() => {});
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@bhagira.in?subject=Water%20Supply%20Inquiry').catch(() => {});
  };

  return (
    <View style={styles.screenShell}>
      <PullToRefreshScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageBody}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshMessage="Refreshing help & contact status..."
      >
        <ScreenHeader
          label="24/7 Assistance"
          title="Help & Support"
          onMenuPress={onOpenMenu}
          onAvatarPress={onOpenMenu}
          isLoggedIn={isLoggedIn}
          onBackPress={onBackPress}
        />

        {/* Contact Support Cards */}
        <View style={styles.contactRow}>
          <Pressable style={styles.contactCard} onPress={handleCall}>
            <View style={[styles.contactIconWrap, { backgroundColor: '#EBF5FF' }]}>
              <Ionicons name="call" size={20} color="#0751A8" />
            </View>
            <Text style={styles.contactCardTitle}>Call Us</Text>
            <Text style={styles.contactCardSub}>+91 93475 57729</Text>
          </Pressable>

          <Pressable style={styles.contactCard} onPress={handleEmail}>
            <View style={[styles.contactIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="mail" size={20} color="#059669" />
            </View>
            <Text style={styles.contactCardTitle}>Email Us</Text>
            <Text style={styles.contactCardSub}>support@bhagira.in</Text>
          </Pressable>
        </View>

        {/* Operating Hours Card */}
        <View style={styles.hoursCard}>
          <Ionicons name="time-outline" size={20} color="#0751A8" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hoursTitle}>Operating Support Hours</Text>
            <Text style={styles.hoursSub}>Mon – Sun: 6:00 AM – 11:00 PM IST</Text>
          </View>
        </View>

        {/* FAQ Section */}
        <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>

        <View style={styles.supportList}>
          <View style={styles.supportItem}>
            <View style={styles.faqTitleRow}>
              <Ionicons name="help-circle" size={18} color="#0751A8" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.supportQuestion}>How quickly can I get a water tanker?</Text>
            </View>
            <Text style={styles.supportAnswer}>
              Most locations receive delivery within 30 to 45 minutes of booking confirmation by the verified local vendor.
            </Text>
          </View>

          <View style={styles.supportItem}>
            <View style={styles.faqTitleRow}>
              <Ionicons name="help-circle" size={18} color="#0751A8" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.supportQuestion}>Can I reschedule my delivery time slot?</Text>
            </View>
            <Text style={styles.supportAnswer}>
              Yes, you can manage or reschedule your active delivery window from your Bookings tab before the tanker is dispatched.
            </Text>
          </View>

          <View style={styles.supportItem}>
            <View style={styles.faqTitleRow}>
              <Ionicons name="help-circle" size={18} color="#0751A8" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.supportQuestion}>Do you provide commercial and bulk tanks?</Text>
            </View>
            <Text style={styles.supportAnswer}>
              Yes, we supply up to 10,000L commercial and residential water tankers for societies, offices, and construction sites.
            </Text>
          </View>

          <View style={styles.supportItem}>
            <View style={styles.faqTitleRow}>
              <Ionicons name="help-circle" size={18} color="#0751A8" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.supportQuestion}>How do I pay for my water order?</Text>
            </View>
            <Text style={styles.supportAnswer}>
              We support UPI (GPay, PhonePe, Paytm), debit/credit cards, net banking, and Cash on Delivery (COD).
            </Text>
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={handleCall}>
          <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Speak with Support Specialist</Text>
        </Pressable>
      </PullToRefreshScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  pageBody: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 135,
    alignSelf: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactCardTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 2,
  },
  contactCardSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 12,
    marginBottom: 20,
  },
  hoursTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 13,
    color: '#0751A8',
  },
  hoursSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  sectionHeading: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 12,
  },
  supportList: {
    gap: 10,
  },
  supportItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  faqTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  supportQuestion: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 14,
    color: '#0F172A',
    flex: 1,
  },
  supportAnswer: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    paddingLeft: 26,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#0751A8',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#0751A8',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
