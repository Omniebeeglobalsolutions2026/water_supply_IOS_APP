import React, { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, AppState, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import PullToRefreshScrollView from '../components/PullToRefreshScrollView';
import ShareOrderModal from '../components/ShareOrderModal';
import { triggerHaptic } from '../utils/mobileNotifications';
import Toast from '../components/Toast';
import { vendorApi } from '../authApi';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

const tankerTruckImages = {
  100: require('../../assets/trucks/truck_100.png'),
  250: require('../../assets/trucks/truck_250.png'),
  500: require('../../assets/trucks/truck_500.png'),
  1000: require('../../assets/trucks/truck_1000.png'),
  1500: require('../../assets/trucks/truck_1500.png'),
  2000: require('../../assets/trucks/truck_2000.png'),
  3000: require('../../assets/trucks/truck_3000.png'),
  4000: require('../../assets/trucks/truck_4000.png'),
  5000: require('../../assets/trucks/truck_5000.png'),
  6000: require('../../assets/trucks/truck_6000.png'),
  7000: require('../../assets/trucks/truck_7000.png'),
  8000: require('../../assets/trucks/truck_8000.png'),
  9000: require('../../assets/trucks/truck_9000.png'),
  10000: require('../../assets/trucks/truck_10000.png'),
  12000: require('../../assets/trucks/truck_12000.png'),
};

function getTankerImage(capacity) {
  const num = Number(capacity);
  if (tankerTruckImages[num]) return tankerTruckImages[num];
  return require('../../assets/trucks/truck_base.png');
}

const portalConfig = {
  user: {
    label: 'Customer',
    accent: '#0284c7',
    title: 'My account',
  },
  vendor: {
    label: 'Vendor',
    accent: '#10b981',
    title: 'Vendor workspace',
  },
};

const tankCapacityOptions = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000];
const waterSourceOptions = [
  { value: 'bore', label: 'Bore' },
  { value: 'well', label: 'Well' },
  { value: 'lake', label: 'Lake' },
  { value: 'rain', label: 'Rain' },
];
const vendorOrderFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Needs confirmation' },
  { value: 'approved', label: 'Confirmed' },
  { value: 'completed', label: 'Delivered' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];
const vendorOrderStatusLabels = {
  pending: 'Needs confirmation',
  waiting_for_vendor: 'Needs confirmation',
  approved: 'Confirmed',
  completed: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
const customerOrderStatusLabels = {
  pending: 'Pending',
  waiting_for_vendor: 'Finding a vendor',
  approved: 'Confirmed',
  completed: 'Delivered',
  rejected: 'Rejected',
  no_vendor_available: 'No vendor available',
  cancelled: 'Cancelled',
};

function normalizeInventory(items) {
  return (Array.isArray(items) ? items : []).map((t) => {
    const id = String(t.id || t._id || '');
    return {
      ...t,
      id,
      _id: id,
    };
  });
}

async function playOrderAlert(soundRef, loop = false) {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldDuckAndroid: true });
    if (!soundRef.current) {
      soundRef.current = createAudioPlayer(require('../../assets/order_alert.wav'));
    }
    soundRef.current.loop = loop;
    soundRef.current.seekTo(0);
    soundRef.current.play();
  } catch (error) {
    console.warn('Unable to play vendor order alert sound.', error);
  }
}

async function stopOrderAlert(soundRef) {
  const sound = soundRef.current;
  if (!sound) return;
  try {
    sound.pause();
    sound.seekTo(0);
  } catch (error) {
    console.warn('Unable to stop vendor order alert sound.', error);
  }
}

export default function PortalScreen({
  role,
  onOpenMenu,
  requests = [],
  currentUser,
  activeVendorTab = 'overview',
  onVendorTabChange,
  onBackPress,
  pushNotificationError = '',
  onModalOpenChange,
  onLogout,
}) {
  const config = portalConfig[role] || portalConfig.user;
  const isCustomer = role === 'user';
  const isVendor = role === 'vendor';
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [isLoadingCustomerOrders, setIsLoadingCustomerOrders] = useState(false);
  const [customerOrdersError, setCustomerOrdersError] = useState('');
  const [isCancellingCustomerOrder, setIsCancellingCustomerOrder] = useState(false);
  const [pendingVendorOrders, setPendingVendorOrders] = useState([]);
  const [orderAlertSilenced, setOrderAlertSilenced] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState || 'active');
  const [inventory, setInventory] = useState([]);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [vendorDashboard, setVendorDashboard] = useState(null);
  const [earningsSummary, setEarningsSummary] = useState({});
  const [earningsPeriod, setEarningsPeriod] = useState('monthly');
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [ordersPage, setOrdersPage] = useState(1);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const ORDERS_PER_PAGE = 5;
  const [workMode, setWorkMode] = useState(true);
  const [isLoadingVendorData, setIsLoadingVendorData] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocationAddress, setSelectedLocationAddress] = useState('');
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [tankCapacity, setTankCapacity] = useState('');
  const [customTankCapacity, setCustomTankCapacity] = useState(false);
  const [tankPrice, setTankPrice] = useState('');
  const [waterSource, setWaterSource] = useState('');
  const [activeTankDropdown, setActiveTankDropdown] = useState('');
  const [tankAvailable, setTankAvailable] = useState(true);
  const [editingTankId, setEditingTankId] = useState(null);
  const [showTankForm, setShowTankForm] = useState(false);
  const [isSavingVendorData, setIsSavingVendorData] = useState(false);
  const [vendorDataError, setVendorDataError] = useState('');
  const [vendorDataMessage, setVendorDataMessage] = useState('');
  const [sharingOrder, setSharingOrder] = useState(null);
  const seenVendorOrderIds = useRef(null);
  const orderAlertSound = useRef(null);

  useEffect(() => {
    onModalOpenChange?.(showTankForm);
  }, [showTankForm]);

  const vendorTabs = ['overview', 'inventory', 'dashboard', 'orders'];

  useEffect(() => {
    if (!isCustomer || appState !== 'active') return undefined;
    let active = true;
    setIsLoadingCustomerOrders(true);
    const refreshOrders = () => {
      vendorApi.customerOrders().then((orders) => {
        if (active) {
          setCustomerOrders(orders);
          setCustomerOrdersError('');
        }
      }).catch((error) => {
        if (active) setCustomerOrdersError(error.message || 'Unable to load your bookings.');
      }).finally(() => {
        if (active) setIsLoadingCustomerOrders(false);
      });
    };
    refreshOrders();
    const intervalId = setInterval(refreshOrders, 15000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isCustomer, appState]);

  useEffect(() => {
    if (!isVendor) return undefined;
    let active = true;
    setIsLoadingVendorData(true);
    Promise.all([vendorApi.profile(), vendorApi.orders('all'), vendorApi.dashboard(earningsPeriod)])
      .then(([profile, orders, dashboard]) => {
        if (!active) return;
        setVendorProfile(profile);
        setInventory(normalizeInventory(profile.inventory));
        setWorkMode(profile.workMode !== false);
        setVendorOrders(orders);
        setPendingVendorOrders(orders.filter((order) => ['pending', 'waiting_for_vendor'].includes(order.status)));
        setVendorDashboard(dashboard);
        setLocationQuery(profile.location?.address || '');
        setSelectedLocationAddress(profile.location?.address || '');
        if (profile.location?.coordinates?.length === 2) {
          setLocationCoordinates({
            longitude: profile.location.coordinates[0],
            latitude: profile.location.coordinates[1],
          });
        }
      }).catch((error) => {
        if (active) setVendorDataError(error.message || 'Unable to load vendor workspace.');
      }).finally(() => {
        if (active) setIsLoadingVendorData(false);
      });
    return () => { active = false; };
  }, [isVendor]);

  useEffect(() => {
    if (!isVendor) return undefined;
    let active = true;
    Promise.all(['daily', 'weekly', 'monthly'].map(async (period) => [
      period,
      await vendorApi.dashboard(period),
    ])).then((entries) => {
      if (active) setEarningsSummary(Object.fromEntries(entries));
    }).catch((error) => {
      if (active) setVendorDataError(error.message || 'Unable to load earnings summaries.');
    });
    return () => { active = false; };
  }, [isVendor]);

  useEffect(() => {
    if (!isVendor) return undefined;
    let active = true;
    setIsLoadingDashboard(true);
    vendorApi.dashboard(earningsPeriod)
      .then((data) => {
        if (active && data) {
          setVendorDashboard(data);
          setEarningsSummary((prev) => ({ ...prev, [earningsPeriod]: data }));
        }
      })
      .catch((error) => {
        if (active) setVendorDataError(error.message || 'Unable to update dashboard metrics.');
      })
      .finally(() => {
        if (active) setIsLoadingDashboard(false);
      });
    return () => { active = false; };
  }, [isVendor, earningsPeriod]);

  useEffect(() => {
    if (!isVendor || appState !== 'active') return undefined;
    let active = true;

    const checkForNewOrders = async () => {
      try {
        const orders = await vendorApi.orders('all');
        if (!active) return;
        setPendingVendorOrders(orders.filter((order) => ['pending', 'waiting_for_vendor'].includes(order.status)));

        const currentOrderIds = new Set(orders.map((order) => order.id));
        if (seenVendorOrderIds.current === null) {
          seenVendorOrderIds.current = currentOrderIds;
        } else {
          const newOrders = orders.filter((order) => (
            ['pending', 'waiting_for_vendor'].includes(order.status) && !seenVendorOrderIds.current.has(order.id)
          ));
          seenVendorOrderIds.current = currentOrderIds;

          if (newOrders.length > 0) {
            setVendorDataMessage(`${newOrders.length} new order${newOrders.length === 1 ? '' : 's'} received.`);
            setOrderAlertSilenced(false);
          }
        }

        setVendorOrders(orders);
      } catch (error) {
        if (active) setVendorDataError(error.message || 'Unable to check for new orders.');
      }
    };

    checkForNewOrders();
    const intervalId = setInterval(checkForNewOrders, 10000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isVendor, appState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isVendor || appState !== 'active' || pendingVendorOrders.length === 0 || orderAlertSilenced) {
      stopOrderAlert(orderAlertSound).catch((error) => {
        console.error('Unable to stop vendor order alert sound.', error);
      });
      if (pendingVendorOrders.length === 0 && orderAlertSilenced) {
        setOrderAlertSilenced(false);
      }
      return undefined;
    }

    playOrderAlert(orderAlertSound, true).catch((error) => {
      setVendorDataError(`Pending orders need your attention, but the buzzer could not play. Tap “Test order buzzer” to enable sound. ${error.message}`);
    });
    return undefined;
  }, [isVendor, appState, pendingVendorOrders.length, orderAlertSilenced]);

  useEffect(() => {
    if (!isVendor) return undefined;
    return () => {
      if (orderAlertSound.current) {
        try {
          orderAlertSound.current.pause();
          orderAlertSound.current.release();
        } catch (error) {
          console.error('Unable to release vendor order alert sound.', error);
        }
        orderAlertSound.current = null;
      }
      seenVendorOrderIds.current = null;
    };
  }, [isVendor]);

  const testOrderAlertSound = async () => {
    setVendorDataError('');
    try {
      await playOrderAlert(orderAlertSound, pendingVendorOrders.length > 0);
      setVendorDataMessage(pendingVendorOrders.length > 0
        ? 'The buzzer will repeat until you accept or reject an order.'
        : 'Order alert sound is ready.');
    } catch (error) {
      setVendorDataError(`Unable to play the order buzzer. Check device volume and browser sound permissions. ${error.message}`);
    }
  };

  const refreshVendorOrders = async () => {
    const [orders, dashboard] = await Promise.all([
      vendorApi.orders('all'),
      vendorApi.dashboard(earningsPeriod),
    ]);
    setPendingVendorOrders(orders.filter((order) => ['pending', 'waiting_for_vendor'].includes(order.status)));
    setVendorOrders(orders);
    setVendorDashboard(dashboard);
    Promise.all(['daily', 'weekly', 'monthly'].map(async (period) => [
      period,
      await vendorApi.dashboard(period),
    ])).then((summaries) => {
      setEarningsSummary(Object.fromEntries(summaries));
    }).catch((error) => {
      setVendorDataError(error.message || 'Unable to refresh earnings summaries.');
    });
  };

  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const handleVendorPullRefresh = async () => {
    setIsPullRefreshing(true);
    triggerHaptic('medium');
    try {
      if (isVendor) {
        await refreshVendorOrders();
      } else {
        const refreshed = await vendorApi.customerOrders();
        setCustomerOrders(refreshed);
      }
      await new Promise((r) => setTimeout(r, 600));
    } catch {} finally {
      setIsPullRefreshing(false);
      triggerHaptic('light');
    }
  };

  const toggleWorkMode = async () => {
    setIsSavingVendorData(true);
    setVendorDataError('');
    setVendorDataMessage('');
    try {
      const result = await vendorApi.setWorkMode(!workMode);
      setWorkMode(result.workMode);
      setVendorDataMessage(result.workMode
        ? 'Work mode is on. Customers can see your available tanks.'
        : 'Work mode is off. Your offers are hidden from new customers.');
    } catch (error) {
      setVendorDataError(error.message || 'Unable to update work mode.');
    } finally {
      setIsSavingVendorData(false);
    }
  };

  const updateOrder = async (order, status) => {
    setIsSavingVendorData(true);
    setVendorDataError('');
    setVendorDataMessage('');
    try {
      await vendorApi.updateOrderStatus(order.id, status, order.currentVendorRequestId);
      if (status === 'approved' || status === 'rejected') {
        setOrderAlertSilenced(true);
        stopOrderAlert(orderAlertSound).catch((error) => {
          console.error('Unable to stop vendor order alert sound after order decision.', error);
        });
      }
      await refreshVendorOrders();
      setVendorDataMessage(status === 'approved'
        ? 'Order accepted.'
        : status === 'rejected' ? 'Order rejected.' : 'Order marked as completed.');
      setSelectedOrder(null);
    } catch (error) {
      setVendorDataError(error.message || 'Unable to update this order.');
    } finally {
      setIsSavingVendorData(false);
    }
  };

  const cancelCustomerBooking = async () => {
    if (!selectedOrder?.id) return;
    setIsCancellingCustomerOrder(true);
    setCustomerOrdersError('');
    try {
      const cancelledOrder = await vendorApi.cancelCustomerOrder(selectedOrder.id);
      setSelectedOrder((current) => ({ ...current, ...cancelledOrder }));
      setCustomerOrders((current) => current.map((order) => (
        order.id === cancelledOrder.id ? { ...order, ...cancelledOrder } : order
      )));
      const refreshedOrders = await vendorApi.customerOrders();
      setCustomerOrders(refreshedOrders);
      setSelectedOrder(refreshedOrders.find((order) => order.id === cancelledOrder.id) || cancelledOrder);
    } catch (error) {
      setCustomerOrdersError(error.message || 'Unable to cancel this booking.');
    } finally {
      setIsCancellingCustomerOrder(false);
    }
  };

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 3 || query === selectedLocationAddress) {
      setLocationSuggestions([]);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (!response.ok) throw new Error(`Address search failed with status ${response.status}.`);
        const results = await response.json();
        if (active) setLocationSuggestions(results);
      } catch (error) {
        if (active) setVendorDataError(error.message || 'Unable to search for that business address.');
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locationQuery, selectedLocationAddress]);

  const saveVendorLocation = async () => {
    if (!locationCoordinates || !locationQuery.trim()) {
      setVendorDataError('Choose a business address from the location suggestions first.');
      return;
    }
    setIsSavingVendorData(true);
    setVendorDataError('');
    setVendorDataMessage('');
    try {
      await vendorApi.updateLocation({
        address: locationQuery.trim(),
        ...locationCoordinates,
      });
      setVendorDataMessage('Business location saved and visible to nearby customers.');
    } catch (error) {
      setVendorDataError(error.message || 'Unable to save the business location.');
    } finally {
      setIsSavingVendorData(false);
    }
  };

  const clearTankForm = () => {
    setEditingTankId(null);
    setTankCapacity('');
    setCustomTankCapacity(false);
    setTankPrice('');
    setWaterSource('');
    setActiveTankDropdown('');
    setTankAvailable(true);
    setVendorDataError('');
  };

  const saveTank = async () => {
    const parsedCapacity = Number(tankCapacity);
    const parsedPrice = Number(tankPrice);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1
      || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !waterSource) {
      setVendorDataError('Choose a tank capacity and water source, then enter a valid price.');
      return;
    }
    setIsSavingVendorData(true);
    setVendorDataError('');
    setVendorDataMessage('');
    try {
      const details = {
        name: `${parsedCapacity.toLocaleString('en-IN')} L Tanker`,
        capacityLiters: parsedCapacity,
        price: parsedPrice,
        waterSource: waterSource.toLowerCase(),
        available: tankAvailable,
      };
      const savedInventory = editingTankId
        ? await vendorApi.updateTank(editingTankId, details)
        : await vendorApi.addTank(details);
      setInventory(normalizeInventory(savedInventory));
      clearTankForm();
      setShowTankForm(false);
      setVendorDataMessage(editingTankId ? 'Tank listing updated.' : 'Tank listing saved.');
    } catch (error) {
      setVendorDataError(error.message || 'Unable to save this tank listing.');
    } finally {
      setIsSavingVendorData(false);
    }
  };

  const editTank = (tank) => {
    const targetId = String(tank.id || tank._id || '');
    setEditingTankId(targetId);
    setTankCapacity(String(tank.capacityLiters));
    setCustomTankCapacity(!tankCapacityOptions.includes(Number(tank.capacityLiters)));
    setTankPrice(String(tank.price));
    setWaterSource(tank.waterSource ? tank.waterSource.toLowerCase() : '');
    setActiveTankDropdown('');
    setTankAvailable(tank.available !== false);
    setVendorDataError('');
    setVendorDataMessage('');
  };

  const removeTank = async (tank) => {
    const targetId = String(tank.id || tank._id || '');
    if (!targetId) return;
    setIsSavingVendorData(true);
    setVendorDataError('');
    setVendorDataMessage('');
    try {
      await vendorApi.deleteTank(targetId);
      setInventory((items) => items.filter((item) => String(item.id || item._id) !== targetId));
      if (editingTankId === targetId) clearTankForm();
      setVendorDataMessage('Tank listing deleted.');
    } catch (error) {
      setVendorDataError(error.message || 'Unable to delete this tank listing.');
    } finally {
      setIsSavingVendorData(false);
    }
  };

  const toggleTankAvailability = async (tank) => {
    const targetId = String(tank.id || tank._id || '');
    if (!targetId) return;
    setIsSavingVendorData(true);
    setVendorDataError('');
    setVendorDataMessage('');
    try {
      const updatedInventory = await vendorApi.updateTank(targetId, {
        name: tank.name,
        capacityLiters: tank.capacityLiters,
        price: tank.price,
        waterSource: (tank.waterSource || 'well').toLowerCase(),
        available: tank.available === false,
      });
      setInventory(normalizeInventory(updatedInventory));
      setVendorDataMessage('Tank availability updated.');
    } catch (error) {
      setVendorDataError(error.message || 'Unable to update tank availability.');
    } finally {
      setIsSavingVendorData(false);
    }
  };

  const renderOrderCard = (order) => {
    const isCompleted = order.status === 'completed';
    const isApproved = order.status === 'approved';
    const isPending = order.status === 'pending' || order.status === 'waiting_for_vendor';
    const isRejected = order.status === 'rejected';

    const statusBadgeStyle = isCompleted
      ? styles.badgeCompleted
      : isApproved
      ? styles.badgeApproved
      : isPending
      ? styles.badgePending
      : isRejected
      ? styles.badgeRejected
      : styles.badgeCancelled;

    const statusBadgeTextStyle = isCompleted
      ? styles.badgeTextCompleted
      : isApproved
      ? styles.badgeTextApproved
      : isPending
      ? styles.badgeTextPending
      : isRejected
      ? styles.badgeTextRejected
      : styles.badgeTextCancelled;

    const statusDotColor = isCompleted
      ? '#10B981'
      : isApproved
      ? '#0751A8'
      : isPending
      ? '#D97706'
      : isRejected
      ? '#EF4444'
      : '#64748B';

    const tankerImg = getTankerImage(order.capacityLiters);

    return (
      <View key={order.id} style={styles.vendorOrderCardNew}>
        <Pressable onPress={() => setSelectedOrder(order)}>
          {/* Header Row: Customer Info + Status Badge */}
          <View style={styles.orderCardHeaderRow}>
            <View style={styles.orderCustomerGroup}>
              <View style={styles.customerAvatarCircle}>
                <Ionicons name="person" size={15} color="#0751A8" />
              </View>
              <View style={styles.customerInfoCol}>
                <Text style={styles.orderCustomerName} numberOfLines={1}>
                  {order.customer || 'Customer'}
                </Text>
                <Text style={styles.orderDateSub}>
                  {order.date || 'Today'} · {order.time || 'Standard Delivery'}
                </Text>
              </View>
            </View>

            <View style={styles.orderHeaderActions}>
              <Pressable
                style={styles.orderShareIconBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setSharingOrder(order);
                }}
                accessibilityRole="button"
                accessibilityLabel="Share Order Details"
              >
                <Ionicons name="share-social-outline" size={16} color="#0751A8" />
              </Pressable>

              <View style={[styles.orderStatusPill, statusBadgeStyle]}>
                <View style={[styles.statusIndicatorDot, { backgroundColor: statusDotColor }]} />
                <Text style={[styles.orderStatusPillText, statusBadgeTextStyle]}>
                  {vendorOrderStatusLabels[order.status] || order.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Middle Tanker & Price Box */}
          <View style={styles.orderTankerBox}>
            <View style={styles.orderTruckWrap}>
              <Image source={tankerImg} style={styles.orderTruckImg} resizeMode="contain" />
              {!tankerTruckImages[Number(order.capacityLiters)] ? (
                <View style={styles.orderTruckOverlayBadge}>
                  <Text style={styles.orderTruckOverlayText}>
                    {Number(order.capacityLiters) >= 1000
                      ? `${(Number(order.capacityLiters) / 1000).toLocaleString('en-IN')}k L`
                      : `${order.capacityLiters} L`}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.orderTankerDetails}>
              <Text style={styles.orderTankerTitle}>
                {Number(order.capacityLiters).toLocaleString('en-IN')} L Tanker
              </Text>
              <View style={styles.orderWaterSourceRow}>
                <Ionicons name="water" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                <Text style={styles.orderWaterSourceText}>
                  {(order.waterSource || 'well').charAt(0).toUpperCase() + (order.waterSource || 'well').slice(1)} Water
                </Text>
              </View>
            </View>

            <View style={styles.orderAmountCol}>
              <Text style={styles.orderAmountText}>
                ₹{Number(order.amount).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.orderPaymentStatus}>
                {order.paymentStatus === 'paid' ? 'Paid Online' : 'Pay on Delivery'}
              </Text>
            </View>
          </View>

          {/* Delivery Address Row */}
          <View style={styles.orderAddressRow}>
            <Ionicons name="location-sharp" size={15} color="#0751A8" style={{ marginTop: 2, marginRight: 6 }} />
            <Text style={styles.orderAddressText} numberOfLines={2}>
              {order.location || order.deliveryAddress || 'Delivery address not specified'}
            </Text>
          </View>
        </Pressable>

        {/* Action Buttons */}
        {isPending ? (
          <View style={styles.orderActionRowNew}>
            <Pressable
              style={styles.orderRejectBtnNew}
              disabled={isSavingVendorData}
              onPress={() => updateOrder(order, 'rejected')}
            >
              <Ionicons name="close" size={16} color="#DC2626" style={{ marginRight: 4 }} />
              <Text style={styles.orderRejectBtnText}>Reject</Text>
            </Pressable>

            <Pressable
              style={styles.orderApproveBtnNew}
              disabled={isSavingVendorData}
              onPress={() => updateOrder(order, 'approved')}
            >
              <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.orderApproveBtnText}>Accept Order</Text>
            </Pressable>
          </View>
        ) : isApproved ? (
          <View style={styles.orderActionRowNew}>
            <Pressable
              style={styles.orderDeliverBtnNew}
              disabled={isSavingVendorData}
              onPress={() => updateOrder(order, 'completed')}
            >
              <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.orderDeliverBtnText}>Mark Delivered</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderVendorTabContent = () => {
    if (activeVendorTab === 'orders') {
      const filteredOrders = orderFilter === 'all'
        ? vendorOrders
        : vendorOrders.filter((order) => (
          orderFilter === 'pending'
            ? ['pending', 'waiting_for_vendor'].includes(order.status)
            : order.status === orderFilter
        ));

      const filterCounts = {
        all: vendorOrders.length,
        pending: vendorOrders.filter((o) => ['pending', 'waiting_for_vendor'].includes(o.status)).length,
        approved: vendorOrders.filter((o) => o.status === 'approved').length,
        completed: vendorOrders.filter((o) => o.status === 'completed').length,
        rejected: vendorOrders.filter((o) => o.status === 'rejected').length,
        cancelled: vendorOrders.filter((o) => o.status === 'cancelled').length,
      };

      const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
      const safePage = Math.min(ordersPage, totalPages);
      const pagedOrders = filteredOrders.slice((safePage - 1) * ORDERS_PER_PAGE, safePage * ORDERS_PER_PAGE);

      return (
        <View style={styles.ordersTabContainer}>
          {/* Header Card with Section Heading and Live Count */}
          <View style={styles.ordersHeaderCard}>
            <View style={styles.ordersTitleRow}>
              <View style={styles.ordersTitleBlock}>
                <Text style={styles.ordersSectionHeading}>Manage Orders</Text>
                <Text style={styles.ordersSectionSub}>
                  Track, accept & fulfill customer deliveries
                </Text>
              </View>
              <View style={styles.ordersTotalBadge}>
                <Text style={styles.ordersTotalBadgeText}>{vendorOrders.length} Total</Text>
              </View>
            </View>

            {/* Filter Chips Horizontal Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipScroll}
            >
              {[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Needs Action' },
                { value: 'approved', label: 'Confirmed' },
                { value: 'completed', label: 'Delivered' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'cancelled', label: 'Cancelled' },
              ].map((filter) => {
                const isActive = orderFilter === filter.value;
                const count = filterCounts[filter.value] || 0;
                return (
                  <Pressable
                    key={filter.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[styles.filterChipItem, isActive && styles.filterChipItemActive]}
                    onPress={() => {
                      setOrderFilter(filter.value);
                      setOrdersPage(1);
                    }}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {filter.label}
                    </Text>
                    <View style={[styles.filterCountBadge, isActive && styles.filterCountBadgeActive]}>
                      <Text style={[styles.filterCountBadgeText, isActive && styles.filterCountBadgeTextActive]}>
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Order Cards List */}
          {isLoadingVendorData ? (
            <ActivityIndicator color="#0751A8" style={{ marginVertical: 32 }} />
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyOrdersCard}>
              <View style={styles.emptyOrdersIconWrap}>
                <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyOrdersTitle}>No Orders Found</Text>
              <Text style={styles.emptyOrdersSub}>
                There are no orders matching the "{vendorOrderFilters.find((f) => f.value === orderFilter)?.label || orderFilter}" filter.
              </Text>
              {orderFilter !== 'all' ? (
                <Pressable
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setOrderFilter('all');
                    setOrdersPage(1);
                  }}
                >
                  <Text style={styles.emptyResetBtnText}>View All Orders</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            pagedOrders.map(renderOrderCard)
          )}

          {/* Pagination */}
          {!isLoadingVendorData && totalPages > 1 ? (
            <View style={styles.paginationCardNew}>
              <Pressable
                style={[styles.pageBtnNew, safePage === 1 && styles.pageBtnNewDisabled]}
                disabled={safePage === 1}
                onPress={() => setOrdersPage((p) => Math.max(1, p - 1))}
              >
                <Ionicons name="chevron-back" size={16} color={safePage === 1 ? '#94A3B8' : '#0751A8'} />
                <Text style={[styles.pageBtnNewText, safePage === 1 && styles.pageBtnNewTextDisabled]}>
                  Prev
                </Text>
              </Pressable>

              <View style={styles.pageDotsGroup}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Pressable
                    key={pageNum}
                    style={[styles.pageDotNew, safePage === pageNum && styles.pageDotNewActive]}
                    onPress={() => setOrdersPage(pageNum)}
                  >
                    <Text style={[styles.pageDotNewText, safePage === pageNum && styles.pageDotNewTextActive]}>
                      {pageNum}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.pageBtnNew, safePage === totalPages && styles.pageBtnNewDisabled]}
                disabled={safePage === totalPages}
                onPress={() => setOrdersPage((p) => Math.min(totalPages, p + 1))}
              >
                <Text style={[styles.pageBtnNewText, safePage === totalPages && styles.pageBtnNewTextDisabled]}>
                  Next
                </Text>
                <Ionicons name="chevron-forward" size={16} color={safePage === totalPages ? '#94A3B8' : '#0751A8'} />
              </Pressable>
            </View>
          ) : null}

          {!isLoadingVendorData && filteredOrders.length > 0 ? (
            <Text style={styles.pageInfoTextNew}>
              Showing {(safePage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(safePage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
            </Text>
          ) : null}
        </View>
      );
    }

    if (activeVendorTab === 'overview') {
      const incomingOrders = vendorOrders.filter((order) => ['pending', 'waiting_for_vendor'].includes(order.status));
      const activeDeliveries = vendorOrders.filter((order) => order.status === 'approved');

      return (
        <View style={styles.overviewContainer}>
          {/* Work Mode Toggle Card */}
          <View style={styles.workModeCardNew}>
            <View style={styles.workModeInfoCol}>
              <View style={styles.workModeTitleRow}>
                <View style={[styles.workModeIconBadge, workMode ? styles.workModeIconBadgeOn : styles.workModeIconBadgeOff]}>
                  <Ionicons name={workMode ? 'radio' : 'pause'} size={17} color={workMode ? '#10B981' : '#64748B'} />
                </View>
                <Text style={styles.workModeTitleNew}>Work Mode</Text>
              </View>
              <View style={styles.workModeStatusRow}>
                <View style={[styles.statusDotLive, { backgroundColor: workMode ? '#10B981' : '#94A3B8' }]} />
                <Text style={[styles.workModeSubtitleNew, workMode && { color: '#15803D' }]}>
                  {workMode ? 'Accepting Orders' : 'Offline & Paused'}
                </Text>
                <Text style={styles.workModeSubtleText}>
                  {workMode ? ' · Tankers visible to customers' : ' · Hidden from search'}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: workMode, disabled: isSavingVendorData }}
              style={[styles.workModeSwitchNew, workMode && styles.workModeSwitchNewOn]}
              disabled={isSavingVendorData}
              onPress={toggleWorkMode}
            >
              {workMode ? (
                <>
                  <Text style={styles.workModeSwitchLabelOn}>ON</Text>
                  <View style={styles.workModeKnobNew} />
                </>
              ) : (
                <>
                  <View style={styles.workModeKnobNew} />
                  <Text style={styles.workModeSwitchLabelOff}>OFF</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Incoming Orders or Listening State Card */}
          {incomingOrders.length > 0 ? (
            <View style={styles.incomingSectionNew}>
              <View style={styles.incomingHeaderCard}>
                <View style={styles.incomingTitleRow}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.incomingSectionTitle}>Incoming Order Requests</Text>
                </View>
                <View style={styles.incomingNewBadge}>
                  <Text style={styles.incomingNewBadgeText}>{incomingOrders.length} Action Needed</Text>
                </View>
              </View>
              <Text style={styles.incomingHeaderSub}>
                Customer booking received! Review delivery location and respond promptly.
              </Text>

              {incomingOrders.map((order) => {
                const tankerImg = getTankerImage(order.capacityLiters);
                return (
                  <View key={order.id} style={styles.incomingOrderCardNew}>
                    <Pressable onPress={() => setSelectedOrder(order)}>
                      <View style={styles.incomingOrderTopRow}>
                        <View style={styles.incomingCustomerGroup}>
                          <View style={styles.customerAvatarCircle}>
                            <Ionicons name="person" size={15} color="#0751A8" />
                          </View>
                          <View>
                            <Text style={styles.incomingCustomerNameNew}>{order.customer || 'Customer'}</Text>
                            <Text style={styles.incomingOrderDateSub}>{order.date || 'Today'} · {order.time || 'QuickTap'}</Text>
                          </View>
                        </View>
                        <View style={styles.orderHeaderActions}>
                          <Pressable
                            style={styles.orderShareIconBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setSharingOrder(order);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Share Order Details"
                          >
                            <Ionicons name="share-social-outline" size={15} color="#0751A8" />
                          </Pressable>
                          <View style={styles.incomingPriceBadgeNew}>
                            <Text style={styles.incomingPriceBadgeText}>₹{Number(order.amount).toLocaleString('en-IN')}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.orderTankerBox}>
                        <View style={styles.orderTruckWrap}>
                          <Image source={tankerImg} style={styles.orderTruckImg} resizeMode="contain" />
                          {!tankerTruckImages[Number(order.capacityLiters)] ? (
                            <View style={styles.orderTruckOverlayBadge}>
                              <Text style={styles.orderTruckOverlayText}>
                                {Number(order.capacityLiters) >= 1000
                                  ? `${(Number(order.capacityLiters) / 1000).toLocaleString('en-IN')}k L`
                                  : `${order.capacityLiters} L`}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.orderTankerDetails}>
                          <Text style={styles.orderTankerTitle}>
                            {Number(order.capacityLiters).toLocaleString('en-IN')} L Tanker
                          </Text>
                          <View style={styles.orderWaterSourceRow}>
                            <Ionicons name="water" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                            <Text style={styles.orderWaterSourceText}>
                              {(order.waterSource || 'well').charAt(0).toUpperCase() + (order.waterSource || 'well').slice(1)} Water
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.orderAddressRow}>
                        <Ionicons name="location-sharp" size={15} color="#0751A8" style={{ marginTop: 2, marginRight: 6 }} />
                        <Text style={styles.orderAddressText} numberOfLines={2}>
                          {order.location || order.deliveryAddress || 'Location provided'}
                        </Text>
                      </View>

                      {order.customerPhone ? (
                        <View style={[styles.orderAddressRow, { marginTop: 6 }]}>
                          <Ionicons name="call-outline" size={14} color="#64748B" style={{ marginTop: 1, marginRight: 6 }} />
                          <Text style={styles.orderAddressText}>{order.customerPhone}</Text>
                        </View>
                      ) : null}
                    </Pressable>

                    <View style={styles.orderActionRowNew}>
                      <Pressable
                        style={styles.orderRejectBtnNew}
                        disabled={isSavingVendorData}
                        onPress={() => updateOrder(order, 'rejected')}
                      >
                        {isSavingVendorData ? (
                          <ActivityIndicator color="#DC2626" size="small" />
                        ) : (
                          <>
                            <Ionicons name="close" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                            <Text style={styles.orderRejectBtnText}>Reject</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        style={styles.orderApproveBtnNew}
                        disabled={isSavingVendorData}
                        onPress={() => updateOrder(order, 'approved')}
                      >
                        {isSavingVendorData ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.orderApproveBtnText}>Accept Order</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.waitingOrdersCardNew}>
              <View style={[styles.radarOuterCircle, !workMode && styles.radarOuterCircleOffline]}>
                <View style={[styles.radarInnerCircle, !workMode && styles.radarInnerCircleOffline]}>
                  <Ionicons
                    name={workMode ? 'radio' : 'pause'}
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <Text style={styles.waitingTitleNew}>
                {workMode ? 'Listening for Orders...' : 'You Are Offline'}
              </Text>
              <Text style={styles.waitingDescriptionNew}>
                {workMode
                  ? 'We are actively listening for water tanker bookings near your dispatch location. When a customer places an order, it will appear here immediately with Accept and Reject actions.'
                  : 'Turn ON Work Mode above so customers in your delivery area can find your fleet and send bookings.'}
              </Text>

              {workMode ? (
                <View style={styles.waitingLiveIndicatorNew}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.waitingLiveTextNew}>Active Radar · Auto-checking every 10s</Text>
                </View>
              ) : (
                <View style={[styles.waitingLiveIndicatorNew, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                  <View style={[styles.livePulseDot, { backgroundColor: '#94A3B8' }]} />
                  <Text style={[styles.waitingLiveTextNew, { color: '#64748B' }]}>Dispatch station paused</Text>
                </View>
              )}
            </View>
          )}

          {/* Active Deliveries (Accepted orders in progress) */}
          {activeDeliveries.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <View style={styles.activeDeliveriesHeaderCard}>
                <View style={styles.activeDeliveriesTitleRow}>
                  <View style={[styles.heroIconBadge, { backgroundColor: '#EBF5FF' }]}>
                    <Ionicons name="cube" size={16} color="#0751A8" />
                  </View>
                  <Text style={styles.activeDeliveriesTitle}>Active Deliveries</Text>
                </View>
                <View style={styles.activeCountBadge}>
                  <Text style={styles.activeCountBadgeText}>{activeDeliveries.length} In Progress</Text>
                </View>
              </View>
              {activeDeliveries.map(renderOrderCard)}
            </View>
          ) : null}
        </View>
      );
    }

    if (activeVendorTab === 'dashboard') {
      const currentDashboard = (vendorDashboard?.period === earningsPeriod ? vendorDashboard : null)
        || earningsSummary[earningsPeriod]
        || vendorDashboard;

      const grossEarning = Number(currentDashboard?.grossEarning || 0);
      const serviceFee = Number(currentDashboard?.serviceFee || 0);
      const netEarning = Number(currentDashboard?.netEarning || 0);
      const totalOrders = Number(currentDashboard?.totalOrders || 0);
      const settledAmount = Number(currentDashboard?.settledAmount || 0);
      const pendingSettlement = Number(currentDashboard?.pendingSettlement || 0);

      const periodLabels = {
        daily: 'Today',
        weekly: 'This Week',
        monthly: 'This Month',
      };

      return (
        <View style={styles.dashboardContainer}>
          {/* Header Card with Title and Segmented Period Filter */}
          <View style={styles.dashboardHeaderCard}>
            <View style={styles.dashboardTitleRow}>
              <View style={styles.dashboardTitleBlock}>
                <Text style={styles.dashboardSectionHeading}>Your Earnings</Text>
                <Text style={styles.dashboardSectionSub}>
                  Revenue & payout overview for {periodLabels[earningsPeriod] || 'selected period'}
                </Text>
              </View>
            </View>

            {/* Segmented Period Tabs */}
            <View style={styles.periodSelectorNew}>
              {[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ].map((period) => {
                const isActive = earningsPeriod === period.value;
                return (
                  <Pressable
                    key={period.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[styles.periodTabNew, isActive && styles.periodTabActiveNew]}
                    onPress={() => setEarningsPeriod(period.value)}
                  >
                    <Text style={[styles.periodTabTextNew, isActive && styles.periodTabTextActiveNew]}>
                      {period.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isLoadingDashboard && !currentDashboard ? (
            <ActivityIndicator color="#0751A8" style={{ marginVertical: 32 }} />
          ) : (
            /* 4-Item Grid of White Metric Cards */
            <View style={styles.dashboardStatsGridNew}>
              {/* Gross Earning */}
              <View style={styles.metricCardNew}>
                <View style={styles.metricCardTopRow}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="trending-up" size={17} color="#15803D" />
                  </View>
                  <Text style={styles.metricCardTag}>Gross</Text>
                </View>
                <Text style={styles.metricCardLabel}>Gross Earning</Text>
                <Text style={styles.metricCardValue}>
                  ₹{grossEarning.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.metricCardHint}>Total order billing</Text>
              </View>

              {/* Service Fee */}
              <View style={styles.metricCardNew}>
                <View style={styles.metricCardTopRow}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="receipt-outline" size={17} color="#475569" />
                  </View>
                  <Text style={styles.metricCardTag}>Fee</Text>
                </View>
                <Text style={styles.metricCardLabel}>Service Fee</Text>
                <Text style={styles.metricCardValue}>
                  ₹{serviceFee.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.metricCardHint}>Platform commission</Text>
              </View>

              {/* Total Orders */}
              <View style={styles.metricCardNew}>
                <View style={styles.metricCardTopRow}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#EBF5FF' }]}>
                    <Ionicons name="water" size={17} color="#0751A8" />
                  </View>
                  <Text style={styles.metricCardTag}>Orders</Text>
                </View>
                <Text style={styles.metricCardLabel}>Total Orders</Text>
                <Text style={styles.metricCardValue}>
                  {totalOrders}
                </Text>
                <Text style={styles.metricCardHint}>Deliveries completed</Text>
              </View>

              {/* Settled Amount */}
              <View style={styles.metricCardNew}>
                <View style={styles.metricCardTopRow}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="checkmark-done" size={17} color="#10B981" />
                  </View>
                  <Text style={[styles.metricCardTag, { color: '#15803D', backgroundColor: '#DCFCE7' }]}>Settled</Text>
                </View>
                <Text style={styles.metricCardLabel}>Settled Amount</Text>
                <Text style={styles.metricCardValue}>
                  ₹{settledAmount.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.metricCardHint}>Transferred to bank</Text>
              </View>
            </View>
          )}
        </View>
      );
    }

    if (activeVendorTab === 'inventory') {
      const availableCount = inventory.filter((tank) => tank.available !== false).length;
      const unavailableCount = inventory.filter((tank) => tank.available === false).length;

      return (
        <View>
          {/* Header Card with Fleet Overview and Add Button */}
          <View style={styles.inventoryHeaderCard}>
            <View style={styles.inventoryTitleRow}>
              <View style={styles.inventoryTitleBlock}>
                <Text style={styles.inventorySectionHeading}>My Tankers</Text>
                <Text style={styles.inventorySectionSub} numberOfLines={1}>Manage fleet & availability</Text>
              </View>
              <Pressable
                style={styles.addTankerTopBtn}
                onPress={() => {
                  clearTankForm();
                  setShowTankForm(true);
                }}
              >
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={styles.addTankerTopBtnText}>Add Tanker</Text>
              </Pressable>
            </View>

            {/* Quick Metrics Badges */}
            <View style={styles.inventoryMetricGrid}>
              <View style={styles.inventoryMetricPill}>
                <Text style={styles.metricLabelText}>Total</Text>
                <Text style={styles.metricValueText}>{inventory.length}</Text>
              </View>
              <View style={[styles.inventoryMetricPill, styles.metricPillGreen]}>
                <View style={styles.activeDotGreen} />
                <Text style={styles.metricLabelGreen}>Available</Text>
                <Text style={styles.metricValueGreen}>{availableCount}</Text>
              </View>
              <View style={[styles.inventoryMetricPill, styles.metricPillSlate]}>
                <View style={styles.activeDotSlate} />
                <Text style={styles.metricLabelSlate}>Offline</Text>
                <Text style={styles.metricValueSlate}>{unavailableCount}</Text>
              </View>
            </View>
          </View>

          {/* List of Tankers */}
          {inventory.length === 0 ? (
            <View style={styles.emptyInventoryCard}>
              <View style={styles.emptyInventoryIconWrap}>
                <Image
                  source={require('../../assets/trucks/truck_base.png')}
                  style={{ width: 84, height: 54 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.emptyInventoryTitle}>No Tankers Listed</Text>
              <Text style={styles.emptyInventoryDesc}>
                Add your water tankers with capacity and price to start receiving orders from customers.
              </Text>
              <Pressable
                style={styles.emptyAddBtn}
                onPress={() => {
                  clearTankForm();
                  setShowTankForm(true);
                }}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={styles.emptyAddBtnText}>Add Your First Tanker</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.tankersList}>
              {inventory.map((tank, index) => {
                const isAvailable = tank.available !== false;
                const waterSourceName = waterSourceOptions.find((o) => o.value === tank.waterSource)?.label || 'Bore';

                return (
                  <View key={tank.id || tank._id || String(index)} style={styles.premiumTankCard}>
                    {/* Top Row: Vehicle Image + Title & Source + Price */}
                    <View style={styles.tankCardTop}>
                      <View style={styles.tankCardLeft}>
                        <View style={styles.tankImageBadge}>
                          <Image
                            source={getTankerImage(tank.capacityLiters)}
                            style={styles.tankTruckImg}
                            resizeMode="contain"
                          />
                          {!tankerTruckImages[Number(tank.capacityLiters)] ? (
                            <View style={styles.orderTruckOverlayBadge}>
                              <Text style={styles.orderTruckOverlayText}>
                                {Number(tank.capacityLiters) >= 1000
                                  ? `${(Number(tank.capacityLiters) / 1000).toLocaleString('en-IN')}k L`
                                  : `${tank.capacityLiters} L`}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.tankNameBlock}>
                          <Text style={styles.tankCapacityHeading}>
                            {Number(tank.capacityLiters).toLocaleString('en-IN')} L Tanker
                          </Text>
                          <View style={styles.waterSourceTag}>
                            <Ionicons name="water" size={12} color="#009BBF" />
                            <Text style={styles.waterSourceTagText}>{waterSourceName} Water</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.tankPriceBlock}>
                        <Text style={styles.tankPriceValue}>₹{Number(tank.price).toLocaleString('en-IN')}</Text>
                        <Text style={styles.tankPriceUnit}>per delivery</Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.tankCardDivider} />

                    {/* Bottom Row: Availability Switch + Edit & Delete Buttons */}
                    <View style={styles.tankCardBottom}>
                      {/* Availability Switch */}
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: isAvailable, disabled: isSavingVendorData }}
                        disabled={isSavingVendorData}
                        onPress={() => toggleTankAvailability(tank)}
                        style={styles.tankStatusToggleRow}
                      >
                        <View style={[styles.tankAvailabilitySwitch, isAvailable && styles.tankAvailabilitySwitchOn]}>
                          <View style={[styles.tankAvailabilityKnob, isAvailable && styles.tankAvailabilityKnobOn]} />
                        </View>
                        <Text style={[styles.tankStatusLabel, isAvailable ? styles.statusTextActive : styles.statusTextInactive]}>
                          {isAvailable ? 'Available' : 'Unavailable'}
                        </Text>
                      </Pressable>

                      {/* Action Buttons */}
                      <View style={styles.tankActionsGroup}>
                        <Pressable
                          style={styles.tankEditBtn}
                          onPress={() => {
                            editTank(tank);
                            setShowTankForm(true);
                          }}
                        >
                          <Ionicons name="create-outline" size={14} color="#0751A8" />
                          <Text style={styles.tankEditBtnText}>Edit</Text>
                        </Pressable>

                        <Pressable
                          style={styles.tankDeleteBtn}
                          onPress={() => removeTank(tank)}
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                          <Text style={styles.tankDeleteBtnText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}

              <Pressable
                style={styles.addTankBottomBtn}
                onPress={() => {
                  clearTankForm();
                  setShowTankForm(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#0284c7" />
                <Text style={styles.addTankBottomBtnText}>Add Another Tanker</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    }

    if (activeVendorTab === 'profile') {
      return (
        <View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Business account</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Business name</Text>
              <Text style={styles.detailValue}>{currentUser?.businessName || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact name</Text>
              <Text style={styles.detailValue}>{currentUser?.name || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{currentUser?.email || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{currentUser?.phone || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Application status</Text>
              <Text style={styles.detailValue}>{vendorProfile?.approvalStatus || currentUser?.approvalStatus || 'approved'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service</Text>
              <Text style={styles.detailValue}>{vendorProfile?.serviceType === 'other' ? 'Other Service' : 'Water Tanker Service'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service radius</Text>
              <Text style={styles.detailValue}>{vendorProfile?.radiusKm || 2} km</Text>
            </View>
            <Text style={styles.sectionTitle}>Bank account details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank and branch</Text>
              <Text style={styles.detailValue}>
                {[vendorProfile?.bankDetails?.bankName, vendorProfile?.bankDetails?.branch].filter(Boolean).join(' · ') || 'Not provided'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account holder</Text>
              <Text style={styles.detailValue}>{vendorProfile?.bankDetails?.holderName || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IFSC</Text>
              <Text style={styles.detailValue}>{vendorProfile?.bankDetails?.ifscCode || 'Not provided'}</Text>
            </View>
            <Text style={styles.sectionTitle}>Business location</Text>
            <Text style={styles.fieldHint}>Choose the location where your tanks are available to customers.</Text>
            <TextInput
              accessibilityLabel="Search business address"
              style={styles.vendorInput}
              value={locationQuery}
              onChangeText={(value) => {
                setLocationQuery(value);
                setSelectedLocationAddress('');
                setLocationCoordinates(null);
                setVendorDataError('');
                setVendorDataMessage('');
              }}
              placeholder="Type your business address"
            />
            {locationSuggestions.length > 0 ? (
              <View style={styles.locationSuggestions}>
                {locationSuggestions.map((result) => (
                  <Pressable
                    key={result.place_id}
                    style={styles.locationSuggestion}
                    onPress={() => {
                      setLocationQuery(result.display_name);
                      setSelectedLocationAddress(result.display_name);
                      setLocationCoordinates({
                        latitude: Number(result.lat),
                        longitude: Number(result.lon),
                      });
                      setLocationSuggestions([]);
                      setVendorDataError('');
                    }}
                  >
                    <Text style={styles.locationSuggestionText}>{result.display_name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {locationCoordinates ? (
              <Text style={styles.fieldHint}>
                Selected coordinates: {locationCoordinates.latitude.toFixed(5)}, {locationCoordinates.longitude.toFixed(5)}
              </Text>
            ) : null}
            <Pressable
              style={[styles.vendorActionButton, isSavingVendorData && styles.vendorActionDisabled]}
              disabled={isSavingVendorData}
              onPress={saveVendorLocation}
            >
              {isSavingVendorData ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.vendorActionText}>Save business location</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    return null;
  };

  const vendorBusinessName = vendorProfile?.businessName || currentUser?.businessName || currentUser?.name || 'Your business';
  const vendorInitial = (vendorBusinessName.trim().charAt(0) || 'A').toUpperCase();
  const vendorAddress = vendorProfile?.location?.address || 'Set your business address in Business profile';

  return (
    <View style={styles.screenWrapper}>
      {vendorDataMessage ? (
        <Toast
          message={vendorDataMessage}
          type="success"
          onDismiss={() => setVendorDataMessage('')}
        />
      ) : null}
      {vendorDataError ? (
        <Toast
          message={vendorDataError}
          type="error"
          onDismiss={() => setVendorDataError('')}
        />
      ) : null}

      {customerOrdersError ? (
        <Toast
          message={customerOrdersError}
          type="error"
          onDismiss={() => setCustomerOrdersError('')}
        />
      ) : null}

      <PullToRefreshScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        onRefresh={handleVendorPullRefresh}
        refreshing={isPullRefreshing}
        refreshMessage="Refreshing vendor orders & dashboard..."
      >
        <ScreenHeader
          label={isVendor ? 'Vendor Workspace' : config.label}
          title={isVendor ? 'Vendor Portal' : config.title}
          onMenuPress={onOpenMenu}
          onAvatarPress={onOpenMenu}
          isLoggedIn={true}
          currentUser={currentUser}
          userInitial={vendorInitial}
          onBackPress={onBackPress}
        />

        {isVendor ? (
          <View style={styles.vendorHeroCard}>
            <Pressable
              style={styles.vendorAvatarCircle}
              onPress={onOpenMenu}
              accessibilityRole="button"
              accessibilityLabel="Vendor Profile & Account Options"
            >
              <Text style={styles.vendorAvatarInitial}>{vendorInitial}</Text>
            </Pressable>
            <View style={styles.vendorHeroInfo}>
              <Text style={styles.vendorHeroName} numberOfLines={1}>
                {vendorBusinessName}
              </Text>
              <View style={styles.vendorRoleRow}>
                <View style={styles.vendorActiveDot} />
                <Text style={styles.vendorRoleText}>Verified Supplier</Text>
              </View>
              <View style={styles.vendorAddressRow}>
                <Ionicons name="location-outline" size={13} color="#009BBF" style={{ marginRight: 4, marginTop: 1 }} />
                <Text style={styles.vendorAddressText} numberOfLines={2}>
                  {vendorAddress}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {isVendor ? (
          <View>
            {renderVendorTabContent()}
          </View>
        ) : isCustomer ? (
        <View>
          <View style={[styles.heroCard, { backgroundColor: config.accent }]}>
            <Text style={styles.heroBadge}>CUSTOMER ACCOUNT</Text>
            <Text style={styles.heroTitle}>{currentUser?.name || config.title}</Text>
            <Text style={styles.heroSubtitle}>Your water bookings and account information.</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{currentUser?.name || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{currentUser?.email || 'Not provided'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{currentUser?.phone || 'Not provided'}</Text>
            </View>
          </View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your bookings</Text>
            {isLoadingCustomerOrders ? <ActivityIndicator color="#0284c7" /> : null}
            {!isLoadingCustomerOrders && customerOrders.length === 0 && !customerOrdersError
              ? <Text style={styles.emptyText}>Your bookings will appear here after you request a delivery.</Text>
              : null}
            {customerOrders.map((order) => (
              <Pressable key={order.id} style={styles.vendorOrderCard} onPress={() => setSelectedOrder(order)}>
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.requestCustomer}>{order.vendor}</Text>
                  <Text style={[
                    styles.orderStatusBadge,
                    order.status === 'approved' || order.status === 'completed' ? styles.successBadge
                      : order.status === 'rejected' || order.status === 'cancelled' || order.status === 'no_vendor_available' ? styles.dangerBadge
                        : styles.warningBadge,
                  ]}>{customerOrderStatusLabels[order.status] || order.status}</Text>
                </View>
                <Text style={styles.requestMeta}>{order.tank} · {Number(order.capacityLiters).toLocaleString('en-IN')} L</Text>
                {order.waterSource ? <Text style={styles.requestMeta}>Water source: {order.waterSource}</Text> : null}
                <Text style={styles.requestMeta}>₹{Number(order.amount).toLocaleString('en-IN')} · {order.date} · {order.time}</Text>
                <Text style={styles.requestMeta}>{order.location}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </PullToRefreshScrollView>

      {/* Order Details Modal */}
      <Modal visible={Boolean(selectedOrder)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Order details</Text>
            {selectedOrder ? (
              <>
                <Text style={styles.modalLabel}>{selectedOrder.customerPhone ? selectedOrder.customer : selectedOrder.vendor}</Text>
                <Text style={styles.modalText}>{selectedOrder.tank} · {Number(selectedOrder.capacityLiters || selectedOrder.capacity).toLocaleString('en-IN')} L</Text>
                {selectedOrder.waterSource ? <Text style={styles.modalText}>Water source: {selectedOrder.waterSource}</Text> : null}
                <Text style={styles.modalText}>{selectedOrder.date} • {selectedOrder.time}</Text>
                <Text style={styles.modalText}>{selectedOrder.location}</Text>
                {selectedOrder.customerPhone ? <Text style={styles.modalText}>Customer phone: {selectedOrder.customerPhone}</Text> : null}
                <Text style={styles.modalText}>Amount: ₹{Number(selectedOrder.amount || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.modalText}>Payment: {selectedOrder.paymentStatus || 'pending'}</Text>
                <Text style={styles.modalText}>Status: {customerOrderStatusLabels[selectedOrder.status] || selectedOrder.status}</Text>
                {isCustomer && selectedOrder.status === 'waiting_for_vendor' ? (
                  <Pressable
                    style={styles.rejectButton}
                    disabled={isCancellingCustomerOrder}
                    onPress={cancelCustomerBooking}
                  >
                    {isCancellingCustomerOrder
                      ? <ActivityIndicator color="#b91c1c" />
                      : <Text style={styles.rejectText}>Cancel booking and request refund</Text>}
                  </Pressable>
                ) : null}
                {isCustomer && customerOrdersError
                  ? <Text style={styles.vendorError}>{customerOrdersError}</Text>
                  : null}

                <Pressable
                  style={styles.modalShareButton}
                  onPress={() => {
                    const orderToShare = selectedOrder;
                    setSelectedOrder(null);
                    setSharingOrder(orderToShare);
                  }}
                >
                  <Ionicons name="share-social-outline" size={16} color="#0751A8" style={{ marginRight: 6 }} />
                  <Text style={styles.modalShareButtonText}>Share Order Details</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable style={styles.modalClose} onPress={() => setSelectedOrder(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ShareOrderModal
        visible={Boolean(sharingOrder)}
        order={sharingOrder}
        onClose={() => setSharingOrder(null)}
        onToast={setVendorDataMessage}
      />

      {/* Add / Edit Tanker Full-Page Screen Modal */}
      <Modal
        visible={showTankForm}
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={() => {
          clearTankForm();
          setShowTankForm(false);
        }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.fullpageModalRoot}>
          {/* Top Full Navigation Bar */}
          <View style={styles.fullpageModalHeader}>
            <Pressable
              hitSlop={12}
              onPress={() => {
                clearTankForm();
                setShowTankForm(false);
              }}
              style={styles.fullpageBackBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </Pressable>
            <View style={styles.fullpageHeaderTitleWrap}>
              <Text style={styles.fullpageModalLabel}>Fleet Management</Text>
              <Text style={styles.fullpageModalTitle}>
                {editingTankId ? 'Edit Tanker' : 'Add New Tanker'}
              </Text>
            </View>
            <Pressable
              hitSlop={12}
              onPress={() => {
                clearTankForm();
                setShowTankForm(false);
              }}
              style={styles.fullpageCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          {vendorDataError ? (
            <View style={styles.modalErrorBanner}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.modalErrorText}>{vendorDataError}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.fullpageModalScroll}
            contentContainerStyle={styles.fullpageModalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Field 1: Tanker Capacity Card */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Ionicons name="speedometer" size={16} color="#0751A8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tankerFieldLabel}>Tanker Capacity</Text>
                  <Text style={styles.tankerFieldSub}>Choose preset volume or enter custom</Text>
                </View>
              </View>

              {/* Quick Capacity Preset Chips */}
              <View style={styles.capacityChipsGrid}>
                {[1000, 2000, 4000, 6000, 8000, 10000].map((capacity) => {
                  const isSelected = String(capacity) === tankCapacity && !customTankCapacity;
                  return (
                    <Pressable
                      key={capacity}
                      style={[styles.capacityQuickChip, isSelected && styles.capacityQuickChipActive]}
                      onPress={() => {
                        setTankCapacity(String(capacity));
                        setCustomTankCapacity(false);
                        setActiveTankDropdown('');
                      }}
                    >
                      <Text style={[styles.capacityQuickChipText, isSelected && styles.capacityQuickChipTextActive]}>
                        {capacity >= 1000 ? `${(capacity / 1000).toLocaleString('en-IN')}k L` : `${capacity} L`}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={13} color="#0751A8" style={{ marginLeft: 3 }} />
                      ) : null}
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.capacityQuickChip, customTankCapacity && styles.capacityQuickChipActive]}
                  onPress={() => {
                    setCustomTankCapacity(true);
                    setTankCapacity('');
                  }}
                >
                  <Text style={[styles.capacityQuickChipText, customTankCapacity && styles.capacityQuickChipTextActive]}>
                    Other...
                  </Text>
                </Pressable>
              </View>

              {customTankCapacity ? (
                <View style={styles.customCapacityInputWrap}>
                  <TextInput
                    accessibilityLabel="Custom capacity in liters"
                    style={styles.tankerInput}
                    value={tankCapacity}
                    onChangeText={setTankCapacity}
                    placeholder="Enter custom capacity (e.g. 5000)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    autoFocus={true}
                  />
                  <Text style={styles.inputUnitText}>Liters</Text>
                </View>
              ) : null}
            </View>

            {/* Field 2: Water Source Card */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Ionicons name="water" size={16} color="#0751A8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tankerFieldLabel}>Water Source</Text>
                  <Text style={styles.tankerFieldSub}>Type of clean water supplied to customers</Text>
                </View>
              </View>

              <View style={styles.waterSourceRow}>
                {waterSourceOptions.map((option) => {
                  const isSelected = option.value === waterSource;
                  const getSourceIcon = (val) => {
                    switch (val) {
                      case 'bore': return 'earth';
                      case 'well': return 'water';
                      case 'lake': return 'boat';
                      case 'rain': return 'rainy';
                      default: return 'water-outline';
                    }
                  };

                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.waterSourceTab, isSelected && styles.waterSourceTabActive]}
                      onPress={() => setWaterSource(option.value)}
                    >
                      <Ionicons
                        name={getSourceIcon(option.value)}
                        size={15}
                        color={isSelected ? '#0751A8' : '#64748B'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.waterSourceTabText, isSelected && styles.waterSourceTabTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Field 3: Price per Delivery Card */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Ionicons name="cash" size={16} color="#0751A8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tankerFieldLabel}>Rate Per Trip</Text>
                  <Text style={styles.tankerFieldSub}>Standard trip rate including delivery</Text>
                </View>
              </View>

              <View style={styles.priceInputWrap}>
                <View style={styles.priceCurrencyBadge}>
                  <Text style={styles.priceCurrencySymbol}>₹</Text>
                </View>
                <TextInput
                  accessibilityLabel="Price in rupees"
                  style={styles.tankerPriceInput}
                  value={tankPrice}
                  onChangeText={setTankPrice}
                  placeholder="e.g. 1500"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
                <Text style={styles.priceSuffixText}>/ trip</Text>
              </View>
            </View>

            {/* Field 4: Fleet Availability Toggle Card */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: tankAvailable }}
              style={[styles.premiumAvailabilityToggle, tankAvailable && styles.availabilityToggleActive]}
              onPress={() => setTankAvailable((available) => !available)}
            >
              <View style={styles.availabilityToggleLeft}>
                <View style={[styles.toggleIndicatorDot, tankAvailable ? styles.dotGreen : styles.dotGrey]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitleText, tankAvailable && styles.toggleTitleTextActive]}>
                    {tankAvailable ? 'Available for Bookings' : 'Currently Inactive'}
                  </Text>
                  <Text style={[styles.toggleSubtitleText, tankAvailable && styles.toggleSubtitleTextActive]}>
                    {tankAvailable ? 'Visible to nearby customers to order' : 'Hidden from customer search results'}
                  </Text>
                </View>
              </View>
              <View style={[styles.tankAvailabilitySwitch, tankAvailable && styles.tankAvailabilitySwitchOn]}>
                <View style={[styles.tankAvailabilityKnob, tankAvailable && styles.tankAvailabilityKnobOn]} />
              </View>
            </Pressable>
          </ScrollView>

          {/* Pinned Action Buttons Footer */}
          <View style={styles.fullpageActionFooter}>
            <Pressable
              style={styles.formCancelBtn}
              onPress={() => {
                clearTankForm();
                setShowTankForm(false);
              }}
            >
              <Text style={styles.formCancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.formSaveBtn, isSavingVendorData && styles.vendorActionDisabled]}
              disabled={isSavingVendorData}
              onPress={saveTank}
            >
              {isSavingVendorData ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.saveBtnContentRow}>
                  <Ionicons
                    name={editingTankId ? 'checkmark-circle' : 'add-circle'}
                    size={18}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.formSaveBtnText}>
                    {editingTankId ? 'Update Tanker' : 'Save Tanker'}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: '#eef7ff',
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#eef7ff',
  },
  content: {
    padding: 18,
    paddingBottom: 145,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94a3b8',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  menuButtonText: {
    fontSize: 22,
    color: '#0f172a',
  },
  headerTextBox: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerLabel: {
    ...TYPOGRAPHY.captionSmall,
    color: '#5f778d',
    marginBottom: 4,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: '#0f172a',
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    ...TYPOGRAPHY.cardTitle,
  },
  customerHero: {
    backgroundColor: '#0f172a',
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
  },
  customerHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  waterBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBadgeText: {
    fontSize: 24,
  },
  heroTag: {
    color: '#dbeafe',
    ...TYPOGRAPHY.navLabel,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  customerHeroTitle: {
    color: '#fff',
    ...TYPOGRAPHY.h1,
    fontSize: 28,
    marginBottom: 8,
  },
  customerHeroSubtitle: {
    color: '#cbd5e1',
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
  },
  customerHeroFooter: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSmall: {
    color: '#cbd5e1',
    ...TYPOGRAPHY.captionSmall,
  },
  heroStrong: {
    color: '#f8fafc',
    ...TYPOGRAPHY.price,
    fontSize: 22,
  },
  primaryButtonSmall: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    ...TYPOGRAPHY.button,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#eaf6ff',
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#94a3b8',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  vendorTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#dbeafe',
  },
  tabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    lineHeight: 20,
  },
  inventoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  inventoryDetails: {
    flex: 1,
    marginRight: 8,
  },
  inventoryActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  smallActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
  },
  smallActionText: {
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteActionText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
  },
  vendorInput: {
    width: '100%',
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  vendorInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vendorInputHalf: {
    flex: 1,
  },
  availabilityToggle: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  availabilityText: {
    color: '#475569',
    fontSize: 13,
  },
  vendorActionButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  vendorActionDisabled: {
    opacity: 0.6,
  },
  vendorActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelEditButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  cancelEditText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  locationSuggestions: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  locationSuggestion: {
    padding: 11,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  locationSuggestionText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 17,
  },
  vendorError: {
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  vendorSuccess: {
    color: '#166534',
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  orderAlertControls: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderAlertHint: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  orderAlertButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  orderAlertButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  inventoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  inventoryMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  inventoryStatusWrap: {
    alignItems: 'flex-end',
  },
  inventoryCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  inventoryStatus: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  notificationItem: {
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
  },
  requestCard: {
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dbeaf5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  requestCustomer: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  requestMeta: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  requestActionRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  approveText: {
    color: '#166534',
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginLeft: 8,
  },
  rejectText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 170,
    marginTop: 8,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  chartValue: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 6,
  },
  chartBar: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#38bdf8',
    minHeight: 30,
  },
  chartLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 8,
  },
  trackButton: {
    backgroundColor: '#0284c7',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }
      : null),
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    padding: 18,
    zIndex: 99999,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
  },
  modalClose: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  hintText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#f1f9ff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  actionText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderStatusBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  successBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  dangerBadge: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  paymentLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  paymentValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  transactionName: {
    fontWeight: '700',
    color: '#0f172a',
  },
  transactionMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284c7',
  },
  liveOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  vendorHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 14,
  },
  vendorAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorAvatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  vendorHeroInfo: {
    flex: 1,
    minWidth: 0,
  },
  vendorHeroName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  vendorRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vendorActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  vendorRoleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#15803D',
  },
  vendorAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 1,
  },
  vendorAddressText: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    flex: 1,
  },
  vendorEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignSelf: 'center',
  },
  vendorEditPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  workModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  workModeTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  workModeSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  workModeSwitch: {
    width: 74,
    height: 36,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    backgroundColor: '#cbd5e1',
  },
  workModeSwitchOn: {
    backgroundColor: '#16a34a',
  },
  workModeKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  workModeSwitchText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  vendorSectionHeading: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 12,
  },
  waitingOrdersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 20,
  },
  waitingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  waitingIconCircleOffline: {
    backgroundColor: '#f1f5f9',
  },
  waitingIconText: {
    fontSize: 28,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingDescription: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
    marginBottom: 16,
  },
  waitingLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  waitingLiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  incomingSection: {
    marginBottom: 20,
  },
  incomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  incomingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  incomingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  incomingBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  incomingBadgeText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  incomingSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
  },
  incomingOrderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    marginBottom: 12,
    shadowColor: '#0284c7',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  incomingOrderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  incomingCustomerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  incomingOrderTank: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
    marginTop: 2,
  },
  incomingPriceBadge: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  incomingPriceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  incomingMetaBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    gap: 4,
    marginBottom: 14,
  },
  incomingMetaText: {
    fontSize: 12,
    color: '#475569',
  },
  incomingActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  incomingRejectBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingRejectBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 14,
  },
  incomingAcceptBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  incomingAcceptBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  approvedCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  orderListHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingCount: {
    color: '#b45309',
    backgroundColor: '#fef3c7',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
  },
  dashboardContainer: {
    width: '100%',
    marginBottom: 36,
  },
  dashboardHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dashboardTitleRow: {
    marginBottom: 14,
  },
  dashboardTitleBlock: {
    flex: 1,
  },
  dashboardSectionHeading: {
    ...TYPOGRAPHY.screenHeading,
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 3,
  },
  dashboardSectionSub: {
    ...TYPOGRAPHY.secondary,
    fontSize: 13,
    color: '#64748B',
  },
  periodSelectorNew: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  periodTabNew: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  periodTabActiveNew: {
    backgroundColor: '#0751A8',
    shadowColor: '#0751A8',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  periodTabTextNew: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  periodTabTextActiveNew: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  netEarningsHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardLabel: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 15,
    color: '#0F172A',
  },
  heroPeriodPill: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroPeriodPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#0751A8',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroCurrencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0751A8',
    marginTop: 4,
    marginRight: 4,
  },
  heroAmountValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  heroFooterStatusText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
  },
  heroFooterGrossText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#64748B',
  },
  dashboardStatsGridNew: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 14,
  },
  metricCardNew: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#0751A8',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardTag: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricCardLabel: {
    ...TYPOGRAPHY.secondary,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  metricCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  metricCardHint: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: '#94A3B8',
  },
  pendingSettlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#D97706',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pendingLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pendingTextWrap: {
    flex: 1,
  },
  pendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  pendingTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 14,
    color: '#0F172A',
  },
  pendingStatusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingStatusBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  pendingSub: {
    ...TYPOGRAPHY.secondary,
    fontSize: 12,
    color: '#64748B',
  },
  pendingAmountText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D97706',
    marginLeft: 10,
  },
  payoutSecurityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 20,
  },
  payoutSecurityNoteText: {
    ...TYPOGRAPHY.secondary,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    flex: 1,
  },
  dashboardOrderCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  viewOrdersText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '800',
  },
  orderFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  orderFilter: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#f1f5f9',
  },
  orderFilterActive: {
    backgroundColor: '#dbeafe',
  },
  orderFilterText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  orderFilterTextActive: {
    color: '#0369a1',
  },
  inventorySummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  /* ── My Tankers Premium Redesign ── */
  inventoryHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  inventoryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  inventoryTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  inventorySectionHeading: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
  },
  inventorySectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addTankerTopBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addTankerTopBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  inventoryMetricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  inventoryMetricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  metricValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricPillGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  activeDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  metricLabelGreen: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  metricValueGreen: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  metricPillSlate: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  activeDotSlate: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  metricLabelSlate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  metricValueSlate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }
      : null),
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 99999,
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }
      : null),
  },
  fullpageModalRoot: {
    flex: 1,
    backgroundColor: '#F5F9FD',
    width: '100%',
  },
  fullpageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 36) + 8 : Platform.OS === 'ios' ? 48 : 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fullpageBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullpageCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullpageHeaderTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  fullpageModalLabel: {
    ...TYPOGRAPHY.captionSmall,
    color: '#0751A8',
    fontSize: 11.5,
    fontFamily: fontFamilies.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullpageModalTitle: {
    ...TYPOGRAPHY.sectionTitle,
    fontSize: 18,
    color: '#0F172A',
    fontFamily: fontFamilies.bold,
  },
  fullpageModalScroll: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F5F9FD',
  },
  fullpageModalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  fullpageActionFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 32 : 18,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
    width: '100%',
  },
  orderTruckOverlayBadge: {
    position: 'absolute',
    left: '60%',
    top: '22%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTruckOverlayText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0751A8',
  },
  tankerModalSheet: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    maxHeight: Platform.OS === 'web' ? '88vh' : '90%',
    shadowColor: '#0751A8',
    shadowOpacity: 0.22,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
    zIndex: 100000,
  },
  vendorProfileModalSheet: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    maxHeight: '90%',
    shadowColor: '#0751A8',
    shadowOpacity: 0.22,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
    zIndex: 100000,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  profileModalTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: '#0F172A',
    fontFamily: fontFamilies.bold,
  },
  profileModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#EDF3F9',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D8E2EE',
  },
  profileModalAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileModalAvatarText: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },
  profileModalInfo: {
    flex: 1,
  },
  profileModalBusinessName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: '#0F172A',
    fontFamily: fontFamilies.bold,
    marginBottom: 3,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  verifiedBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#16A34A',
    fontFamily: fontFamilies.semibold,
  },
  profileModalSub: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    fontSize: 12,
  },
  profileDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 16,
    gap: 10,
  },
  profileDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileDetailLabel: {
    ...TYPOGRAPHY.caption,
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: fontFamilies.medium,
  },
  profileDetailValue: {
    ...TYPOGRAPHY.bodySmall,
    color: '#0F172A',
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 1,
  },
  profileDetailDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
  },
  profileEditTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F9',
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D8E2EE',
  },
  profileEditTabBtnText: {
    ...TYPOGRAPHY.buttonSmall,
    color: '#0751A8',
    fontSize: 13,
    fontFamily: fontFamilies.semibold,
  },
  profileLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  profileLogoutBtnText: {
    ...TYPOGRAPHY.button,
    color: '#DC2626',
    fontSize: 14,
    fontFamily: fontFamilies.bold,
  },
  modalDragHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  tankFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  tankHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tankHeaderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#D0E3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tankHeaderTextWrap: {
    flex: 1,
  },
  tankFormMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  tankFormSubTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  formCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tankerModalScroll: {
    width: '100%',
    maxHeight: 520,
    flexShrink: 1,
  },
  tankerModalScrollContent: {
    paddingBottom: 12,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tankerFieldLabel: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: fontFamilies.bold,
  },
  tankerFieldSub: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    marginTop: 1,
  },
  tankerPriceHint: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '500',
    marginLeft: 6,
  },
  capacityChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  capacityQuickChip: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityQuickChipActive: {
    backgroundColor: '#EBF5FF',
    borderColor: '#0751A8',
  },
  capacityQuickChipText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569',
  },
  capacityQuickChipTextActive: {
    color: '#0751A8',
  },
  customCapacityInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#0751A8',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputUnitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 6,
  },
  waterSourceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  waterSourceTab: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  waterSourceTabActive: {
    backgroundColor: '#EBF5FF',
    borderColor: '#0751A8',
  },
  waterSourceTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  waterSourceTabTextActive: {
    color: '#0751A8',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  priceCurrencyBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  priceCurrencySymbol: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0751A8',
  },
  tankerPriceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceSuffixText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  premiumAvailabilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  availabilityToggleActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  availabilityToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  toggleIndicatorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#16A34A',
  },
  dotGrey: {
    backgroundColor: '#94A3B8',
  },
  toggleTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  toggleTitleTextActive: {
    color: '#15803D',
  },
  toggleSubtitleText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  toggleSubtitleTextActive: {
    color: '#166534',
  },
  tankAvailabilitySwitch: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 2,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
  },
  tankAvailabilitySwitchOn: {
    backgroundColor: '#10B981',
  },
  tankAvailabilityKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  tankAvailabilityKnobOn: {
    alignSelf: 'flex-end',
  },
  formActionFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#ffffff',
  },
  formCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14.5,
  },
  formSaveBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 13,
    backgroundColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  saveBtnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
  tankersList: {
    gap: 12,
  },
  premiumTankCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 12,
  },
  tankCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tankCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tankImageBadge: {
    width: 62,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#D8E8F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  tankTruckImg: {
    width: '100%',
    height: '100%',
  },
  tankNameBlock: {
    flex: 1,
  },
  tankCapacityHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  waterSourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  waterSourceTagText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0369A1',
  },
  tankPriceBlock: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  tankPriceValue: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0751A8',
  },
  tankPriceUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  tankCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  tankCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tankStatusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tankStatusLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803D',
  },
  statusTextInactive: {
    color: '#64748B',
  },
  tankActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tankEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
  },
  tankEditBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0751A8',
  },
  tankDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
  },
  tankDeleteBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  addTankBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
    marginTop: 6,
  },
  addTankBottomBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyInventoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyInventoryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyInventoryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptyInventoryDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  tankerOptionActive: {
    backgroundColor: '#f0f9ff',
  },
  tankerOptionTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },
  inventorySummaryItem: {
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    fontSize: 11,
    fontWeight: '700',
  },
  inventoryAvailable: {
    color: '#15803d',
  },
  inventoryUnavailable: {
    color: '#b91c1c',
  },
  tankForm: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14,
  },
  tankFormTitle: {
    color: '#fff',
    backgroundColor: '#0284c7',
    marginHorizontal: -14,
    marginTop: -14,
    paddingVertical: 15,
    textAlign: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 16,
  },
  tankerServicesBanner: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#082a4b',
    padding: 16,
    marginBottom: 20,
  },
  tankerServicesArtwork: {
    width: 92,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 46,
    backgroundColor: '#0c568e',
    marginRight: 12,
  },
  tankerServicesDrop: {
    fontSize: 32,
  },
  tankerServicesVehicle: {
    fontSize: 34,
    marginTop: -2,
  },
  tankerServicesCopy: {
    flex: 1,
  },
  tankerServicesOverline: {
    color: '#7dd3fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  tankerServicesHeadline: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },
  tankerServicesCaption: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  tankerFieldLabel: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 7,
  },
  tankerPriceHint: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  tankerSelect: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  tankerSelectText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  tankerPlaceholder: {
    color: '#94a3b8',
  },
  tankerSelectChevron: {
    color: '#1f2937',
    fontSize: 22,
    lineHeight: 25,
  },
  tankerOptionList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginTop: 6,
    marginBottom: 2,
    elevation: 3,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tankerOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f2',
  },
  tankerOptionText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  tankerInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 15,
    paddingHorizontal: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  tankerSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  tankAvailabilitySwitch: {
    width: 48,
    height: 28,
    borderRadius: 15,
    padding: 3,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    marginTop: 8,
  },
  tankAvailabilitySwitchOn: {
    backgroundColor: '#16a34a',
    alignItems: 'flex-end',
  },
  tankAvailabilityKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  tankAvailabilityKnobOn: {
    alignSelf: 'flex-end',
  },
  addTankButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addTankButtonText: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '800',
  },
  vendorOrderCard: {
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  orderActionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  warningBadge: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  pageButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  pageButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  pageButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  pageButtonTextDisabled: {
    color: '#94a3b8',
  },
  pageIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ordersTabContainer: {
    width: '100%',
    marginBottom: 36,
  },
  ordersHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ordersTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ordersTitleBlock: {
    flex: 1,
    marginRight: 10,
  },
  ordersSectionHeading: {
    ...TYPOGRAPHY.screenHeading,
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 3,
  },
  ordersSectionSub: {
    ...TYPOGRAPHY.secondary,
    fontSize: 13,
    color: '#64748B',
  },
  ordersTotalBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ordersTotalBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#0751A8',
  },
  filterChipScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipItemActive: {
    backgroundColor: '#0751A8',
    borderColor: '#0751A8',
  },
  filterChipText: {
    ...TYPOGRAPHY.button,
    fontSize: 12,
    color: '#64748B',
    marginRight: 6,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterCountBadgeTextActive: {
    color: '#FFFFFF',
  },
  vendorOrderCardNew: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderShareIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE7F3',
  },
  modalShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  modalShareButtonText: {
    ...TYPOGRAPHY.buttonSmall,
    color: '#0751A8',
    fontFamily: fontFamilies.semibold,
  },
  orderCustomerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  customerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customerInfoCol: {
    flex: 1,
  },
  orderCustomerName: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 15,
    color: '#0F172A',
  },
  orderDateSub: {
    ...TYPOGRAPHY.secondary,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  orderStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  orderStatusPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextCompleted: {
    color: '#15803D',
  },
  badgeApproved: {
    backgroundColor: '#EBF5FF',
  },
  badgeTextApproved: {
    color: '#0751A8',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextPending: {
    color: '#D97706',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  badgeTextRejected: {
    color: '#DC2626',
  },
  badgeCancelled: {
    backgroundColor: '#F1F5F9',
  },
  badgeTextCancelled: {
    color: '#64748B',
  },
  orderTankerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  orderTruckWrap: {
    width: 52,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderTruckImg: {
    width: 44,
    height: 30,
  },
  orderTankerDetails: {
    flex: 1,
  },
  orderTankerTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 2,
  },
  orderWaterSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderWaterSourceText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  orderAmountCol: {
    alignItems: 'flex-end',
  },
  orderAmountText: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 17,
    color: '#0751A8',
    fontWeight: '800',
  },
  orderPaymentStatus: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  orderAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  orderAddressText: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
  },
  orderActionRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  orderRejectBtnNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
  },
  orderRejectBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  orderApproveBtnNew: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0751A8',
    borderRadius: 10,
    paddingVertical: 10,
    shadowColor: '#0751A8',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  orderApproveBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  orderDeliverBtnNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  orderDeliverBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyOrdersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyOrdersIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyOrdersTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyOrdersSub: {
    ...TYPOGRAPHY.secondary,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyResetBtn: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyResetBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: '#0751A8',
  },
  paginationCardNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  pageBtnNew: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  pageBtnNewDisabled: {
    opacity: 0.5,
  },
  pageBtnNewText: {
    ...TYPOGRAPHY.button,
    fontSize: 12,
    color: '#0751A8',
  },
  pageBtnNewTextDisabled: {
    color: '#94A3B8',
  },
  pageDotsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  pageDotNew: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageDotNewActive: {
    backgroundColor: '#0751A8',
  },
  pageDotNewText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  pageDotNewTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pageInfoTextNew: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  overviewContainer: {
    width: '100%',
    marginBottom: 36,
  },
  workModeCardNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  workModeInfoCol: {
    flex: 1,
    marginRight: 14,
  },
  workModeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  workModeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  workModeIconBadgeOn: {
    backgroundColor: '#DCFCE7',
  },
  workModeIconBadgeOff: {
    backgroundColor: '#F1F5F9',
  },
  workModeTitleNew: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 16,
    color: '#0F172A',
  },
  workModeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  workModeSubtitleNew: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  workModeSubtleText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: '#94A3B8',
  },
  workModeSwitchNew: {
    width: 68,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    backgroundColor: '#CBD5E1',
  },
  workModeSwitchNewOn: {
    backgroundColor: '#10B981',
  },
  workModeKnobNew: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  workModeSwitchLabelOn: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },
  workModeSwitchLabelOff: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    marginRight: 6,
  },
  waitingOrdersCardNew: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 16,
  },
  radarOuterCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#BAE6FD',
  },
  radarOuterCircleOffline: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  radarInnerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  radarInnerCircleOffline: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  waitingTitleNew: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 17,
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingDescriptionNew: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 340,
    marginBottom: 18,
  },
  waitingLiveIndicatorNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
  },
  waitingLiveTextNew: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  incomingSectionNew: {
    marginBottom: 16,
  },
  incomingHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  incomingSectionTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 15,
    color: '#0F172A',
  },
  incomingNewBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  incomingNewBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  incomingHeaderSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  incomingOrderCardNew: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginBottom: 14,
    shadowColor: '#0284C7',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  incomingOrderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  incomingCustomerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  incomingCustomerNameNew: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 15,
    color: '#0F172A',
  },
  incomingOrderDateSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  incomingPriceBadgeNew: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  incomingPriceBadgeText: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  activeDeliveriesHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  activeDeliveriesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeDeliveriesTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 15,
    color: '#0F172A',
  },
  activeCountBadge: {
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeCountBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#0751A8',
  },
});
