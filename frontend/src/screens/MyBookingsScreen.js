import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import PullToRefreshScrollView from '../components/PullToRefreshScrollView';
import ShareOrderModal from '../components/ShareOrderModal';
import { vendorApi } from '../authApi';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

const statusConfig = {
  pending: { label: 'Pending', icon: 'time-outline', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  waiting_for_vendor: { label: 'Finding Vendor', icon: 'search-outline', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  approved: { label: 'Confirmed', icon: 'checkmark-circle-outline', bg: '#E0F2FE', text: '#0284C7', border: '#BAE6FD' },
  completed: { label: 'Delivered', icon: 'checkmark-circle', bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  rejected: { label: 'Rejected', icon: 'close-circle', bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  no_vendor_available: { label: 'Unavailable', icon: 'alert-circle-outline', bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' },
};

const formatWaterSource = (source) => {
  if (!source) return '';
  const map = {
    well: 'Well Water',
    bore: 'Borewell Water',
    lake: 'Lake Water',
    rain: 'Rainwater',
  };
  return map[source.toLowerCase()] || `${source.charAt(0).toUpperCase() + source.slice(1)} Water`;
};

const formatOrderDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

export default function MyBookingsScreen({
  setActiveScreen,
  isLoggedIn,
  currentUser,
  onOpenMenu,
  onBackPress,
  latestBookingStatus,
  onSelectTank,
}) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [sharingOrder, setSharingOrder] = useState(null);

  const fetchOrders = async (showLoadingSpinner = true) => {
    if (!isLoggedIn) {
      // If not logged in, check if there is a local latestBookingStatus
      if (latestBookingStatus) {
        setOrders([
          {
            id: latestBookingStatus.id || 'WF-LOCAL',
            vendor: latestBookingStatus.vendor || 'BHAGIRA Partner',
            tank: latestBookingStatus.tank || 'Water Tanker',
            capacityLiters: latestBookingStatus.capacityLiters || 1000,
            amount: latestBookingStatus.amount || 1200,
            paymentStatus: latestBookingStatus.payment || 'paid',
            status: latestBookingStatus.status || 'waiting_for_vendor',
            date: latestBookingStatus.date || 'Today',
            time: latestBookingStatus.time || latestBookingStatus.eta || 'Standard slot',
            location: latestBookingStatus.location || 'Your delivery location',
          },
        ]);
      } else {
        setOrders([]);
      }
      return;
    }

    if (showLoadingSpinner) setIsLoading(true);
    setError('');

    try {
      const fetched = await vendorApi.customerOrders();
      let combined = Array.isArray(fetched) ? fetched : [];

      // If latestBookingStatus exists and not in fetched, prepend it
      if (latestBookingStatus && latestBookingStatus.id) {
        const alreadyExists = combined.some((o) => o.id === latestBookingStatus.id);
        if (!alreadyExists) {
          combined = [
            {
              id: latestBookingStatus.id,
              vendor: latestBookingStatus.vendor || 'BHAGIRA Partner',
              tank: latestBookingStatus.tank || 'Water Tanker',
              capacityLiters: latestBookingStatus.capacityLiters || 1000,
              amount: latestBookingStatus.amount || 1200,
              paymentStatus: latestBookingStatus.payment || 'paid',
              status: latestBookingStatus.status || 'waiting_for_vendor',
              date: latestBookingStatus.date || 'Today',
              time: latestBookingStatus.time || latestBookingStatus.eta || 'Standard slot',
              location: latestBookingStatus.location || 'Your delivery location',
            },
            ...combined,
          ];
        }
      }

      setOrders(combined);
    } catch (err) {
      // If error but we have local latestBookingStatus, show local
      if (latestBookingStatus) {
        setOrders([
          {
            id: latestBookingStatus.id || 'WF-LOCAL',
            vendor: latestBookingStatus.vendor || 'BHAGIRA Partner',
            tank: latestBookingStatus.tank || 'Water Tanker',
            capacityLiters: latestBookingStatus.capacityLiters || 1000,
            amount: latestBookingStatus.amount || 1200,
            paymentStatus: latestBookingStatus.payment || 'paid',
            status: latestBookingStatus.status || 'waiting_for_vendor',
            date: latestBookingStatus.date || 'Today',
            time: latestBookingStatus.time || 'Standard slot',
            location: latestBookingStatus.location || 'Your delivery location',
          },
        ]);
      } else {
        setError(err.message || 'Unable to load bookings.');
      }
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);
  }, [isLoggedIn, latestBookingStatus]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders(false);
  };

  const handleCancelOrder = async (orderId) => {
    if (!orderId) return;
    setIsCancelling(true);
    try {
      await vendorApi.cancelCustomerOrder(orderId);
      await fetchOrders(false);
      setSelectedOrder(null);
    } catch (err) {
      alert(err.message || 'Could not cancel booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  const activeCount = orders.filter((o) => ['pending', 'waiting_for_vendor', 'approved'].includes(o.status)).length;
  const pastCount = orders.filter((o) => ['completed', 'cancelled', 'rejected', 'no_vendor_available'].includes(o.status)).length;

  const handleBookAgain = (order) => {
    const capacity = order.capacityLiters || order.capacity || 1000;
    const tank = {
      id: capacity,
      liters: `${Number(capacity).toLocaleString('en-IN')} L`,
      litersNum: Number(capacity),
      price: `₹${Number(order.amount || 0).toLocaleString('en-IN')}`,
    };
    if (onSelectTank) {
      onSelectTank(tank);
    } else {
      setActiveScreen('home');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === 'active') {
      return ['pending', 'waiting_for_vendor', 'approved'].includes(order.status);
    }
    if (activeFilter === 'completed') {
      return ['completed', 'cancelled', 'rejected', 'no_vendor_available'].includes(order.status);
    }
    return true;
  });

  return (
    <View style={styles.screenShell}>
      <PullToRefreshScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        refreshMessage="Refreshing your bookings..."
      >
        <ScreenHeader
          label="Orders & History"
          title="My Bookings"
          onMenuPress={onOpenMenu}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onBackPress={onBackPress}
        />

        {/* Filter Tabs if user has orders */}
        {orders.length > 0 && (
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
                All ({orders.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, activeFilter === 'active' && styles.filterChipActive]}
              onPress={() => setActiveFilter('active')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'active' && styles.filterChipTextActive]}>
                Active ({activeCount})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, activeFilter === 'completed' && styles.filterChipActive]}
              onPress={() => setActiveFilter('completed')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'completed' && styles.filterChipTextActive]}>
                Past & Delivered ({pastCount})
              </Text>
            </Pressable>
          </View>
        )}

        {/* Loading State */}
        {isLoading ? (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="large" color="#0751A8" />
            <Text style={styles.stateSubText}>Loading your bookings…</Text>
          </View>
        ) : null}

        {/* Error State */}
        {!isLoading && error && orders.length === 0 ? (
          <View style={styles.stateCenter}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={styles.stateTitle}>Unable to load bookings</Text>
            <Text style={styles.stateSubText}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => fetchOrders(true)}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Empty State: NO BOOKINGS ARE DONE */}
        {!isLoading && !error && orders.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyIconBadge}>
              <View style={styles.emptyIconInner}>
                <Image
                  source={require('../../assets/trucks/truck_1000.png')}
                  style={styles.emptyTruckImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text style={styles.emptyTitle}>No bookings are done</Text>
            <Text style={styles.emptyMessage}>
              You haven't placed any water tanker orders yet. Book clean, certified water delivered quickly to your doorstep.
            </Text>

            {/* Feature Highlights */}
            <View style={styles.perksRow}>
              <View style={styles.perkBadge}>
                <Ionicons name="flash" size={13} color="#0751A8" style={{ marginRight: 5 }} />
                <Text style={styles.perkBadgeText}>QuickTap 30-45m</Text>
              </View>
              <View style={styles.perkBadge}>
                <Ionicons name="water" size={13} color="#0284C7" style={{ marginRight: 5 }} />
                <Text style={styles.perkBadgeText}>Clean Water</Text>
              </View>
              <View style={styles.perkBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#10B981" style={{ marginRight: 5 }} />
                <Text style={styles.perkBadgeText}>Verified Vendors</Text>
              </View>
            </View>

            <Pressable
              style={styles.bookCtaBtn}
              onPress={() => setActiveScreen('home')}
            >
              <Ionicons name="water" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.bookCtaBtnText}>Book Water Tanker Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        ) : null}

        {/* Filtered Empty State */}
        {!isLoading && orders.length > 0 && filteredOrders.length === 0 ? (
          <View style={styles.stateCenter}>
            <Ionicons name="filter-outline" size={40} color="#94a3b8" />
            <Text style={styles.stateTitle}>No {activeFilter} bookings</Text>
            <Text style={styles.stateSubText}>Switch to "All" to view your full booking history.</Text>
          </View>
        ) : null}

        {/* Orders List */}
        {!isLoading && filteredOrders.length > 0 && (
          <View style={styles.ordersList}>
            {filteredOrders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const formattedPrice = Number(order.amount || 0).toLocaleString('en-IN');
              const capacity = order.capacityLiters || order.capacity || 1000;
              const waterSourceText = formatWaterSource(order.waterSource);

              return (
                <Pressable
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => setSelectedOrder(order)}
                >
                  {/* Card Header: Vendor Info & Status Badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.vendorWrap}>
                      <View style={styles.vendorAvatar}>
                        <Ionicons name="water" size={18} color="#0751A8" />
                      </View>
                      <View style={styles.vendorTextCol}>
                        <Text style={styles.vendorName} numberOfLines={1}>
                          {order.vendor || 'BHAGIRA Water Supply'}
                        </Text>
                        <View style={styles.orderIdBadgeRow}>
                          <Text style={styles.orderIdText}>
                            Order #{String(order.id).slice(-6).toUpperCase()}
                          </Text>
                          {order.createdAt ? (
                            <>
                              <Text style={styles.orderDot}>•</Text>
                              <Text style={styles.orderDateText}>
                                {formatOrderDate(order.createdAt)}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Status Badge with Icon & Share Button */}
                    <View style={styles.cardHeaderRightActions}>
                      <Pressable
                        style={styles.orderShareBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setSharingOrder(order);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Share order details"
                      >
                        <Ionicons name="share-social-outline" size={15} color="#0751A8" />
                      </Pressable>

                      <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
                        <Ionicons name={status.icon} size={12} color={status.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: status.text }]}>
                          {status.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Order Specs & Delivery Summary Box */}
                  <View style={styles.summaryBox}>
                    {/* Tanker Spec Row */}
                    <View style={styles.specRow}>
                      <View style={styles.specLeft}>
                        <View style={styles.tankerPill}>
                          <Ionicons name="cube-outline" size={13} color="#0751A8" style={{ marginRight: 4 }} />
                          <Text style={styles.tankerPillText}>
                            {Number(capacity).toLocaleString('en-IN')} LTR Tanker
                          </Text>
                        </View>
                        {waterSourceText ? (
                          <View style={styles.waterSourceTag}>
                            <Text style={styles.waterSourceText}>{waterSourceText}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Delivery Schedule Row */}
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={14} color="#64748B" style={styles.infoIcon} />
                      <Text style={styles.infoText} numberOfLines={1}>
                        {order.date || 'Today'} · {order.time || 'Standard Slot'}
                      </Text>
                    </View>

                    {/* Delivery Address Row (2 lines max, no early cutoff) */}
                    {order.location ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={14} color="#0751A8" style={styles.infoIcon} />
                        <Text style={styles.infoAddressText} numberOfLines={2}>
                          {order.location}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Card Footer: Amount and Actions */}
                  <View style={styles.cardFooter}>
                    <View style={styles.priceCol}>
                      <Text style={styles.amountLabel}>Total Amount</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.amountValue}>₹{formattedPrice}</Text>
                        {order.paymentStatus === 'paid' ? (
                          <View style={styles.paidBadge}>
                            <Ionicons name="checkmark" size={10} color="#15803D" style={{ marginRight: 2 }} />
                            <Text style={styles.paidBadgeText}>Paid</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      {['approved', 'waiting_for_vendor'].includes(order.status) ? (
                        <Pressable
                          style={styles.trackBtn}
                          onPress={() => setActiveScreen('tracking')}
                        >
                          <Ionicons name="navigate-circle-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.trackBtnText}>Track</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.bookAgainBtnSmall}
                          onPress={() => handleBookAgain(order)}
                        >
                          <Ionicons name="refresh" size={13} color="#0751A8" style={{ marginRight: 4 }} />
                          <Text style={styles.bookAgainBtnSmallText}>Book Again</Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={styles.detailsBtn}
                        onPress={() => setSelectedOrder(order)}
                      >
                        <Text style={styles.detailsBtnText}>Details</Text>
                        <Ionicons name="chevron-forward" size={13} color="#475569" style={{ marginLeft: 2 }} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </PullToRefreshScrollView>

      {/* Order Details Modal */}
      <Modal visible={Boolean(selectedOrder)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <Pressable style={styles.modalCloseIconBtn} onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            {selectedOrder ? (
              <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
                {/* Status Hero */}
                {(() => {
                  const modalStatus = statusConfig[selectedOrder.status] || statusConfig.pending;
                  return (
                    <View style={styles.modalStatusBanner}>
                      <View style={[styles.statusBadge, { backgroundColor: modalStatus.bg, borderColor: modalStatus.border }]}>
                        <Ionicons name={modalStatus.icon} size={13} color={modalStatus.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: modalStatus.text }]}>
                          {modalStatus.label}
                        </Text>
                      </View>
                      <Text style={styles.modalAmountBig}>
                        ₹{Number(selectedOrder.amount || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.modalPaymentStatus}>
                        Payment: {selectedOrder.paymentStatus ? selectedOrder.paymentStatus.toUpperCase() : 'PAID'}
                      </Text>
                    </View>
                  );
                })()}

                {/* Details Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionHeading}>Delivery Details</Text>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Vendor</Text>
                    <Text style={styles.modalVal}>{selectedOrder.vendor || 'BHAGIRA Water Supply'}</Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tanker</Text>
                    <Text style={styles.modalVal}>
                      {selectedOrder.tank} · {Number(selectedOrder.capacityLiters || selectedOrder.capacity || 1000).toLocaleString('en-IN')} L
                    </Text>
                  </View>

                  {selectedOrder.waterSource ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Water Source</Text>
                      <Text style={styles.modalVal}>{formatWaterSource(selectedOrder.waterSource)}</Text>
                    </View>
                  ) : null}

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Schedule</Text>
                    <Text style={styles.modalVal}>{selectedOrder.date} · {selectedOrder.time}</Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Address</Text>
                    <Text style={[styles.modalVal, { maxWidth: '65%' }]}>{selectedOrder.location || 'Not provided'}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                {selectedOrder.status === 'waiting_for_vendor' ? (
                  <Pressable
                    style={styles.cancelBookingBtn}
                    disabled={isCancelling}
                    onPress={() => handleCancelOrder(selectedOrder.id)}
                  >
                    <Text style={styles.cancelBookingBtnText}>
                      {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </Text>
                  </Pressable>
                ) : null}

                {['approved', 'waiting_for_vendor'].includes(selectedOrder.status) ? (
                  <Pressable
                    style={styles.modalTrackBtn}
                    onPress={() => {
                      setSelectedOrder(null);
                      setActiveScreen('tracking');
                    }}
                  >
                    <Ionicons name="navigate" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalTrackBtnText}>Track Live Delivery</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.modalShareBtn}
                  onPress={() => {
                    const orderToShare = selectedOrder;
                    setSelectedOrder(null);
                    setSharingOrder(orderToShare);
                  }}
                >
                  <Ionicons name="share-social-outline" size={16} color="#0751A8" style={{ marginRight: 6 }} />
                  <Text style={styles.modalShareBtnText}>Share Order Details</Text>
                </Pressable>

                <Pressable
                  style={styles.bookAgainBtn}
                  onPress={() => {
                    const orderToBook = selectedOrder;
                    setSelectedOrder(null);
                    handleBookAgain(orderToBook);
                  }}
                >
                  <Text style={styles.bookAgainBtnText}>Book This Tanker Again</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <ShareOrderModal
        visible={Boolean(sharingOrder)}
        order={sharingOrder}
        onClose={() => setSharingOrder(null)}
      />
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
    paddingBottom: Platform.OS === 'android' ? 165 : 135,
    alignSelf: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: '#0751A8',
    borderColor: '#0751A8',
  },
  filterChipText: {
    fontSize: 12.5,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  stateCenter: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  stateSubText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#0751A8',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyStateCard: {
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
  emptyIconBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EBF5FF',
    borderWidth: 4,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyIconInner: {
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
  emptyTruckImage: {
    width: 52,
    height: 36,
  },
  emptyTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    ...TYPOGRAPHY.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 320,
  },
  perksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  perkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  perkBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  bookCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0751A8',
    paddingHorizontal: 26,
    height: 48,
    borderRadius: 14,
    shadowColor: '#0751A8',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bookCtaBtnText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  ordersList: {
    gap: 14,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderShareBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE7F3',
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F9',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  modalShareBtnText: {
    ...TYPOGRAPHY.buttonSmall,
    color: '#0751A8',
    fontFamily: fontFamilies.semibold,
  },
  vendorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  vendorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorTextCol: {
    flex: 1,
  },
  vendorName: {
    fontSize: 14.5,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#0F172A',
  },
  orderIdBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  orderIdText: {
    fontSize: 11.5,
    fontFamily: fontFamilies.medium,
    color: '#64748B',
  },
  orderDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  orderDateText: {
    fontSize: 11.5,
    fontFamily: fontFamilies.regular,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 12,
    gap: 8,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  specLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  tankerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  tankerPillText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#0751A8',
  },
  waterSourceTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  waterSourceText: {
    fontSize: 11.5,
    fontFamily: fontFamilies.medium,
    color: '#475569',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  infoIcon: {
    marginTop: 1.5,
  },
  infoText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: '#475569',
    flex: 1,
  },
  infoAddressText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  priceCol: {
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 10.5,
    fontFamily: fontFamilies.medium,
    color: '#64748B',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountValue: {
    fontSize: 17,
    fontFamily: fontFamilies.bold,
    fontWeight: '800',
    color: '#0F172A',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  paidBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0751A8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#0751A8',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  trackBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookAgainBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bookAgainBtnSmallText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: '#0751A8',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  detailsBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: '600',
    color: '#475569',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollBody: {
    width: '100%',
  },
  modalStatusBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  modalAmountBig: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 8,
  },
  modalPaymentStatus: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  modalSection: {
    marginBottom: 20,
    gap: 10,
  },
  modalSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  modalVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
  },
  cancelBookingBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelBookingBtnText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 14,
  },
  modalTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  modalTrackBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bookAgainBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  bookAgainBtnText: {
    color: '#0751A8',
    fontWeight: '700',
    fontSize: 14,
  },
});
