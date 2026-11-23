import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

export default function TrackingScreen({ setActiveScreen, isLoggedIn, onOpenMenu, onBackPress, mode = 'customer', deliveries = [] }) {
  const vendorDeliveries = deliveries.length > 0 ? deliveries : [
    {
      id: 901,
      orderId: 'WT-1045',
      customer: 'Rahul Sharma',
      tank: 'Standard 1000 L',
      status: 'On route',
      eta: '6:20 PM',
      driver: 'Arjun Kumar',
      phone: '+91 98765 43210',
      location: '12, Green Park Colony, Bengaluru',
      progress: 68,
    },
  ];

  if (mode === 'vendor') {
    return (
      <View style={styles.screenShell}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageBody}>
          <ScreenHeader
            label="Vendor dispatch"
            title="Assigned orders"
            onMenuPress={onOpenMenu}
            onAvatarPress={onOpenMenu}
            isLoggedIn={isLoggedIn}
            onBackPress={onBackPress}
          />

          {vendorDeliveries.map((delivery) => (
            <View key={delivery.id} style={styles.vendorCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.sectionTitle}>{delivery.orderId}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{delivery.status}</Text>
                </View>
              </View>

              <Text style={styles.customerName}>{delivery.customer}</Text>
              <Text style={styles.detailText}>{delivery.tank}</Text>
              <Text style={styles.detailText}>{delivery.location}</Text>

              <View style={styles.progressLine}>
                <View style={[styles.progressFill, { width: `${delivery.progress || 50}%` }]} />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>Driver</Text>
                <Text style={styles.fieldValue}>{delivery.driver}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>ETA</Text>
                <Text style={styles.fieldValue}>{delivery.eta}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.fieldLabel}>Contact</Text>
                <Text style={styles.fieldValue}>{delivery.phone}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screenShell}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageBody}
      >
        <ScreenHeader
          label="Live status"
          title="Tracking"
          onMenuPress={onOpenMenu}
          onAvatarPress={onOpenMenu}
          isLoggedIn={isLoggedIn}
          onBackPress={onBackPress}
        />

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Order #WT-1045</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>In transit</Text>
            </View>
          </View>

          <View style={styles.progressLine}>
            <View style={styles.progressFill} />
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleDone]}><Text>✓</Text></View>
              <Text style={styles.stepText}>Booked</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleDone]}><Text>✓</Text></View>
              <Text style={styles.stepText}>Packed</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepCircle}><Text>3</Text></View>
              <Text style={styles.stepText}>On route</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepCircle}><Text>4</Text></View>
              <Text style={styles.stepText}>Delivered</Text>
            </View>
          </View>
        </View>

        <View style={styles.bookingCard}>
          <Text style={styles.sectionTitle}>Delivery info</Text>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Driver</Text>
            <Text style={styles.fieldValue}>Arjun Kumar</Text>
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>ETA</Text>
            <Text style={styles.fieldValue}>Today, 6:20 PM</Text>
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Contact</Text>
            <Text style={styles.fieldValue}>+91 98765 43210</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 18,
    paddingBottom: 110,
    alignSelf: 'center',
  },
  vendorCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  customerName: {
    ...TYPOGRAPHY.cardTitle,
    color: '#0f172a',
    marginBottom: 6,
  },
  detailText: {
    ...TYPOGRAPHY.bodySmall,
    color: '#475569',
    marginBottom: 5,
  },
  detailRow: {
    marginTop: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...TYPOGRAPHY.sectionTitle,
    color: '#0f172a',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    ...TYPOGRAPHY.navLabel,
    color: '#166534',
  },
  progressLine: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    marginBottom: 18,
  },
  progressFill: {
    width: '65%',
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 999,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepCircleDone: {
    backgroundColor: '#bbf7d0',
  },
  stepText: {
    ...TYPOGRAPHY.captionSmall,
    color: '#475569',
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  fieldBlock: {
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f3f8ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
