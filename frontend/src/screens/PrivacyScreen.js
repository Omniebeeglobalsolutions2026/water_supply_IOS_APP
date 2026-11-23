import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { TYPOGRAPHY } from '../theme/typography';

export default function PrivacyScreen({ onBackPress, onOpenMenu, isLoggedIn, currentUser }) {
  return (
    <View style={styles.screenShell}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ScreenHeader
          label="Legal & Policies"
          title="Privacy Policy"
          onBackPress={onBackPress}
          onMenuPress={onOpenMenu}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
        />

        <View style={styles.headerCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={28} color="#0751A8" />
          </View>
          <Text style={styles.docTitle}>BHAGIRA Privacy Policy</Text>
          <Text style={styles.docSubtitle}>Last Updated: November 2026</Text>
          <Text style={styles.docIntro}>
            At BHAGIRA, we respect your privacy and are committed to protecting the personal information you share with us.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>1. Information We Collect</Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.boldText}>Account Information:</Text> When you register, we collect your full name, mobile phone number, email address, and account password (securely hashed).
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.boldText}>Delivery & Location Data:</Text> When you book a tanker, we collect your GPS location and delivery street address to dispatch nearby water tankers efficiently.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.boldText}>Order & Payment Details:</Text> We store order history, selected tanker capacities, date/time slots, and transaction payment references.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>2. How We Use Your Information</Text>
          <Text style={styles.bodyText}>
            • To process and fulfill your water tanker delivery bookings accurately.
          </Text>
          <Text style={styles.bodyText}>
            • To share delivery coordinates and contact info with the assigned tanker driver for seamless navigation.
          </Text>
          <Text style={styles.bodyText}>
            • To automatically save your delivery addresses without duplication for fast 1-tap reordering.
          </Text>
          <Text style={styles.bodyText}>
            • To send booking confirmations, status updates, live tracking alerts, and invoices.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>3. Information Sharing</Text>
          <Text style={styles.bodyText}>
            We do not sell, rent, or trade your personal information to third-party marketers. Your contact and address details are shared strictly with verified water suppliers and drivers assigned to fulfill your specific order.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>4. Data Security & Storage</Text>
          <Text style={styles.bodyText}>
            We employ industry-standard encryption protocols (HTTPS/TLS) and secure database storage to safeguard your data. Sensitive credentials such as passwords and payment tokens are hashed and encrypted.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>5. Location Permissions</Text>
          <Text style={styles.bodyText}>
            The application requests device location access solely to detect nearby water tanker depots and provide accurate delivery estimates. You may choose to manually type your address at any time if you prefer not to enable GPS.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>6. Your Privacy Rights</Text>
          <Text style={styles.bodyText}>
            You have the right to view, update, or edit your personal profile information (name, phone, email) anytime via the My Profile section. You may also request account deletion by reaching out to our support team.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>7. Privacy Support</Text>
          <Text style={styles.bodyText}>
            If you have questions or concerns about how your data is handled, please contact our Data Protection Officer at privacy@bhagira.in.
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#F5F9FD',
  },
  scrollView: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 520,
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 135,
    alignSelf: 'center',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  docTitle: {
    ...TYPOGRAPHY.screenHeading,
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  docSubtitle: {
    ...TYPOGRAPHY.secondary,
    color: '#64748B',
    marginBottom: 10,
  },
  docIntro: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#0751A8',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeading: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 16,
    color: '#0751A8',
    marginBottom: 8,
  },
  bodyText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    marginBottom: 6,
  },
  boldText: {
    fontWeight: '600',
    color: '#0F172A',
  },
});
