import React, { useState, useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';
import {
  getStoredNotifications,
  saveNotifications,
  sendLocalNotification,
  requestNotificationPermission,
  triggerHaptic,
} from '../utils/mobileNotifications';

export default function NotificationCenterModal({ visible, onClose, onNotificationCountChange }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (visible) {
      const list = getStoredNotifications();
      setNotifications(list);
      requestNotificationPermission();
    }
  }, [visible]);

  const markAllAsRead = () => {
    triggerHaptic('light');
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
    onNotificationCountChange?.(0);
  };

  const clearAll = () => {
    triggerHaptic('light');
    setNotifications([]);
    saveNotifications([]);
    onNotificationCountChange?.(0);
  };

  const handleTestNotification = async () => {
    triggerHaptic('heavy');
    const notif = await sendLocalNotification({
      title: '🚚 Tanker Out for Delivery!',
      body: 'Your 1000L water tanker has been dispatched. Driver Arjun is 12 mins away.',
      data: { orderId: 'WT-1045' },
    });
    if (notif) {
      const updated = [notif, ...notifications];
      setNotifications(updated);
      onNotificationCountChange?.(updated.filter((n) => !n.read).length);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const ANDROID_STATUS_BAR = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 36) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.fullPageContainer, { paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR : Platform.OS === 'ios' ? 48 : 16 }]}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <Pressable
            style={styles.backButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close notifications"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <View style={styles.bellIconWrap}>
              <Ionicons name="notifications" size={18} color="#0751A8" />
              {unreadCount > 0 && <View style={styles.unreadBadgeDot} />}
            </View>
            <View>
              <Text style={styles.pageTitle}>Notifications</Text>
              <Text style={styles.pageSubtitle}>
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </Pressable>
        </View>

        {/* Quick Actions Bar */}
        <View style={styles.quickActionsBar}>
          <Pressable style={styles.testNotifButton} onPress={handleTestNotification}>
            <Ionicons name="flash-outline" size={14} color="#0751A8" />
            <Text style={styles.testNotifText}>Send Test Alert</Text>
          </Pressable>

          <View style={styles.rightActions}>
            {unreadCount > 0 && (
              <Pressable onPress={markAllAsRead} style={styles.actionLinkButton}>
                <Text style={styles.actionLinkText}>Mark all read</Text>
              </Pressable>
            )}
            {notifications.length > 0 && (
              <Pressable onPress={clearAll} style={styles.actionLinkButton}>
                <Text style={[styles.actionLinkText, { color: '#94A3B8' }]}>Clear all</Text>
              </Pressable>
            )}
          </View>
        </View>

          {/* Notifications List */}
          <ScrollView
            style={styles.listScrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="notifications-off-outline" size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>
                  You'll be notified here when tanker drivers dispatch or update order status.
                </Text>
              </View>
            ) : (
              notifications.map((item) => (
                <View
                  key={item.id}
                  style={[styles.notificationCard, !item.read && styles.unreadNotificationCard]}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardTime}>{item.time || 'Recently'}</Text>
                  </View>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  {!item.read && <View style={styles.unreadMarker} />}
                </View>
              ))
            )}
          </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullPageContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 12,
  },
  pageTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: '#0F172A',
    fontFamily: fontFamilies.bold,
  },
  pageSubtitle: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    marginTop: 1,
  },
  bellIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  sheetTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: '#0F172A',
  },
  sheetSubtitle: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    marginTop: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  testNotifButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  testNotifText: {
    ...TYPOGRAPHY.caption,
    color: '#0751A8',
    fontFamily: fontFamilies.semibold,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLinkButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionLinkText: {
    ...TYPOGRAPHY.caption,
    color: '#0751A8',
    fontFamily: fontFamilies.medium,
  },
  listScrollView: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  unreadNotificationCard: {
    backgroundColor: '#F0F7FF',
    borderColor: '#BAE6FD',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#0F172A',
    fontFamily: fontFamilies.semibold,
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    ...TYPOGRAPHY.caption,
    color: '#94A3B8',
    fontSize: 11,
  },
  cardBody: {
    ...TYPOGRAPHY.bodySmall,
    color: '#475569',
    lineHeight: 18,
  },
  unreadMarker: {
    position: 'absolute',
    left: 4,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#0751A8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: '#475569',
    marginBottom: 6,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.caption,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
  },
});
