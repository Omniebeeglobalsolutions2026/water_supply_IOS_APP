import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';
import {
  formatOrderShareText,
  shareToWhatsApp,
  shareToSms,
  copyOrderToClipboard,
  nativeShareOrder,
} from '../utils/orderShare';
import { triggerHaptic } from '../utils/mobileNotifications';

export default function ShareOrderModal({ visible, order, onClose, onToast }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!order) return null;

  const handleWhatsApp = async () => {
    triggerHaptic('medium');
    await shareToWhatsApp(order);
    onToast?.('Opening WhatsApp...', 'info');
    onClose?.();
  };

  const handleCopy = async () => {
    triggerHaptic('medium');
    const success = await copyOrderToClipboard(order);
    if (success) {
      setCopied(true);
      onToast?.('Order details copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      onToast?.('Unable to copy to clipboard.', 'error');
    }
  };

  const handleSms = async () => {
    triggerHaptic('medium');
    await shareToSms(order);
    onToast?.('Opening Messages...', 'info');
    onClose?.();
  };

  const handleSystemShare = async () => {
    triggerHaptic('medium');
    await nativeShareOrder(order);
    onClose?.();
  };

  const customerName = order.customer || order.customerName || 'Customer';
  const customerPhone = order.customerPhone || order.phone || 'Not provided';
  const address = order.location || order.deliveryAddress || 'Address not specified';
  const capacity = order.capacityLiters || order.capacity || 1000;
  const liters = `${Number(capacity).toLocaleString('en-IN')} LTR`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.shareBadge}>
                <Ionicons name="share-social" size={20} color="#0751A8" />
              </View>
              <View>
                <Text style={styles.title}>Share Order Details</Text>
                <Text style={styles.subtitle}>
                  Send tanker & delivery details via WhatsApp or SMS
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close share sheet"
            >
              <Ionicons name="close" size={20} color="#475569" />
            </Pressable>
          </View>

          {/* Key Order Info Summary Pill */}
          <View style={styles.infoSummaryCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={15} color="#0751A8" style={{ marginRight: 8 }} />
              <Text style={styles.infoLabel}>Customer:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{customerName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={15} color="#0751A8" style={{ marginRight: 8 }} />
              <Text style={styles.infoLabel}>Mobile:</Text>
              <Text style={styles.infoValue}>{customerPhone}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={15} color="#0751A8" style={{ marginRight: 8 }} />
              <Text style={styles.infoLabel}>Tank Capacity:</Text>
              <Text style={styles.infoValue}>{liters}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={15} color="#0751A8" style={{ marginRight: 8 }} />
              <Text style={styles.infoLabel}>Location:</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{address}</Text>
            </View>
          </View>

          {/* Share Channels Grid */}
          <Text style={styles.sectionHeading}>Share Via</Text>
          <View style={styles.channelsGrid}>
            {/* WhatsApp */}
            <Pressable style={styles.channelButton} onPress={handleWhatsApp}>
              <View style={[styles.channelIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#16A34A" />
              </View>
              <Text style={styles.channelLabel}>WhatsApp</Text>
              <Text style={styles.channelSub}>Instant chat</Text>
            </Pressable>

            {/* Copy Details */}
            <Pressable style={styles.channelButton} onPress={handleCopy}>
              <View style={[styles.channelIconWrap, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={24}
                  color={copied ? '#16A34A' : '#0284C7'}
                />
              </View>
              <Text style={styles.channelLabel}>{copied ? 'Copied!' : 'Copy Text'}</Text>
              <Text style={styles.channelSub}>To clipboard</Text>
            </Pressable>

            {/* SMS */}
            <Pressable style={styles.channelButton} onPress={handleSms}>
              <View style={[styles.channelIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#D97706" />
              </View>
              <Text style={styles.channelLabel}>Messages</Text>
              <Text style={styles.channelSub}>SMS text</Text>
            </Pressable>

            {/* System Share */}
            <Pressable style={styles.channelButton} onPress={handleSystemShare}>
              <View style={[styles.channelIconWrap, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="share-outline" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.channelLabel}>More</Text>
              <Text style={styles.channelSub}>System share</Text>
            </Pressable>
          </View>

          {/* Message Preview Accordion */}
          <Pressable
            style={styles.previewToggle}
            onPress={() => setShowPreview(!showPreview)}
          >
            <Ionicons name="eye-outline" size={16} color="#0751A8" style={{ marginRight: 6 }} />
            <Text style={styles.previewToggleText}>
              {showPreview ? 'Hide Message Preview' : 'View Formatted Message Preview'}
            </Text>
            <Ionicons
              name={showPreview ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#0751A8"
              style={{ marginLeft: 'auto' }}
            />
          </Pressable>

          {showPreview && (
            <ScrollView style={styles.previewBox} showsVerticalScrollIndicator={false}>
              <Text style={styles.previewText}>{formatOrderShareText(order)}</Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    maxHeight: '85%',
    ...Platform.select({
      web: {
        boxShadow: '0 -10px 40px rgba(7, 81, 168, 0.15)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shareBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: '#0F172A',
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  infoSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoLabel: {
    ...TYPOGRAPHY.caption,
    fontFamily: fontFamilies.semibold,
    color: '#475569',
    width: 100,
  },
  infoValue: {
    ...TYPOGRAPHY.bodySmall,
    color: '#0F172A',
    fontFamily: fontFamilies.medium,
    flex: 1,
  },
  sectionHeading: {
    ...TYPOGRAPHY.navLabel,
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  channelsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  channelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  channelIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  channelLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
    color: '#0F172A',
  },
  channelSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#EDF3F9',
    borderRadius: 12,
    marginTop: 4,
  },
  previewToggleText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
    color: '#0751A8',
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  previewText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
    lineHeight: 17,
  },
});
