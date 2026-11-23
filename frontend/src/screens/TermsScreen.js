import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { TYPOGRAPHY } from '../theme/typography';

export default function TermsScreen({ onBackPress, onOpenMenu, isLoggedIn, currentUser }) {
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
          title="Terms & Conditions"
          onBackPress={onBackPress}
          onMenuPress={onOpenMenu}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
        />

        <View style={styles.headerCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="document-text" size={28} color="#0751A8" />
          </View>
          <Text style={styles.docTitle}>BHAGIRA Terms of Service</Text>
          <Text style={styles.docSubtitle}>Last Updated: November 2026</Text>
          <Text style={styles.docIntro}>
            Please review these terms and conditions carefully before booking water tanker services through the BHAGIRA mobile application.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>1. Acceptance of Terms</Text>
          <Text style={styles.bodyText}>
            By accessing or using the BHAGIRA application, booking water tankers, or signing up as a user or vendor, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, please do not use the application.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>2. Service Overview</Text>
          <Text style={styles.bodyText}>
            BHAGIRA operates as an on-demand technology platform connecting consumers who require water delivery with registered, verified water tanker suppliers and drivers. BHAGIRA facilitates booking, dispatching, route tracking, and payment processing.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>3. Booking & Delivery</Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.boldText}>Accuracy of Address:</Text> You agree to provide a clear, accessible, and accurate delivery address. Tankers require appropriate road width and height clearance.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.boldText}>Scheduled Slots:</Text> While our suppliers endeavor to arrive within the chosen delivery slot, delivery times may vary slightly due to traffic, road closures, or adverse weather conditions.
          </Text>
          <Text style={styles.bodyText}>
            • <Text style={styles.boldText}>Access on Site:</Text> You must ensure an authorized person is available at the delivery location with proper sump or overhead tank connection pipes ready.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>4. Pricing & Payments</Text>
          <Text style={styles.bodyText}>
            • All prices displayed in the app are calculated based on tanker capacity, distance, and prevailing regional supply rates.
          </Text>
          <Text style={styles.bodyText}>
            • Payments can be made online via supported payment methods (UPI, cards, net banking) or via Cash on Delivery where permitted.
          </Text>
          <Text style={styles.bodyText}>
            • In the event that no vendor accepts your booking request, any advance payment made will be refunded automatically to your original payment method.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>5. Water Quality & Intended Use</Text>
          <Text style={styles.bodyText}>
            Water supplied through our platform is sourced from local borewells, treated municipal points, or verified private wells as indicated. Unless explicitly labeled as potable drinking water certified by laboratory tests, tanker water is intended for domestic utility, construction, gardening, or cleaning purposes.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>6. Cancellation & Refunds</Text>
          <Text style={styles.bodyText}>
            • Free cancellation is permitted if cancelled before a vendor accepts and dispatches the tanker.
          </Text>
          <Text style={styles.bodyText}>
            • Once a tanker is en route, cancellations may incur a nominal transit fee to compensate the delivery driver.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>7. User Conduct & Security</Text>
          <Text style={styles.bodyText}>
            You are responsible for maintaining the confidentiality of your account credentials and mobile login OTPs. Any unauthorized usage should be reported to BHAGIRA Support immediately.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>8. Contact Us</Text>
          <Text style={styles.bodyText}>
            If you have questions regarding these Terms & Conditions, please contact us at support@bhagira.in or call our customer care hotline.
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
