import React, { Suspense, useEffect, useState, lazy, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { TYPOGRAPHY, fontFamilies } from './src/theme/typography';

import AppMenu from './src/components/AppMenu';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScreenLoadingFallback from './src/components/ScreenLoadingFallback';
import { sendLocalNotification, triggerHaptic } from './src/utils/mobileNotifications';

const ServicesScreen = lazy(() => import('./src/screens/ServicesScreen'));
const LoginScreen = lazy(() => import('./src/screens/LoginScreen'));
const SignUpScreen = lazy(() => import('./src/screens/SignUpScreen'));
const ForgotPasswordScreen = lazy(() => import('./src/screens/ForgotPasswordScreen'));
const ResetPasswordScreen = lazy(() => import('./src/screens/ResetPasswordScreen'));
const OtpVerificationScreen = lazy(() => import('./src/screens/OtpVerificationScreen'));
const BookingScreen = lazy(() => import('./src/screens/BookingScreen'));
const MyBookingsScreen = lazy(() => import('./src/screens/MyBookingsScreen'));
const TrackingScreen = lazy(() => import('./src/screens/TrackingScreen'));
const SupportScreen = lazy(() => import('./src/screens/SupportScreen'));
const PortalScreen = lazy(() => import('./src/screens/PortalScreen'));
const MyProfileScreen = lazy(() => import('./src/screens/MyProfileScreen'));
const TermsScreen = lazy(() => import('./src/screens/TermsScreen'));
const PrivacyScreen = lazy(() => import('./src/screens/PrivacyScreen'));
import Toast from './src/components/Toast';
import { tankOptions, slots } from './src/data/mockData';
import { authApi, vendorApi } from './src/authApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getInitialNavigation = () => {
  let screen = 'home';
  let vendorTab = 'overview';
  let history = ['home'];
  let deliveryLocation = null;
  let selectedTank = tankOptions[1];
  let selectedOffer = null;

  if (Platform.OS === 'web' && globalThis.localStorage) {
    try {
      const savedScreen = globalThis.localStorage.getItem('waterflow.activeScreen');
      const savedVendorTab = globalThis.localStorage.getItem('waterflow.vendorActiveTab');
      const rawHistory = globalThis.localStorage.getItem('waterflow.screenHistory');
      const rawLocation = globalThis.localStorage.getItem('waterflow.deliveryLocation');
      const rawTank = globalThis.localStorage.getItem('waterflow.selectedTank');
      const rawOffer = globalThis.localStorage.getItem('waterflow.selectedOffer');

      if (savedScreen) screen = savedScreen;
      if (savedVendorTab) vendorTab = savedVendorTab;
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed) && parsed.length > 0) history = parsed;
      }
      if (rawLocation) {
        const parsedLoc = JSON.parse(rawLocation);
        if (parsedLoc && Number.isFinite(parsedLoc.latitude) && Number.isFinite(parsedLoc.longitude)) {
          deliveryLocation = parsedLoc;
        }
      }
      if (rawTank) {
        const parsedTank = JSON.parse(rawTank);
        if (parsedTank && parsedTank.liters) {
          selectedTank = parsedTank;
        }
      }
      if (rawOffer) {
        const parsedOffer = JSON.parse(rawOffer);
        if (parsedOffer && parsedOffer.capacityLiters) {
          selectedOffer = parsedOffer;
        }
      }
    } catch {}
  }
  return {
    screen,
    vendorTab,
    history,
    deliveryLocation,
    selectedTank,
    selectedOffer,
  };
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const initialNav = getInitialNavigation();
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [screenHistory, setScreenHistory] = useState(initialNav.history);
  const [activeScreen, setActiveScreen] = useState(initialNav.screen);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedLoginRole, setSelectedLoginRole] = useState('user');
  const [currentUser, setCurrentUser] = useState(null);
  const [vendorActiveTab, setVendorActiveTab] = useState(initialNav.vendorTab);
  const [deliveryLocation, setDeliveryLocation] = useState(initialNav.deliveryLocation);
  const [selectedTank, setSelectedTank] = useState(initialNav.selectedTank || tankOptions[1]);
  const [selectedOffer, setSelectedOffer] = useState(initialNav.selectedOffer);
  const [selectedSlot, setSelectedSlot] = useState(slots[0]);
  const [globalToast, setGlobalToast] = useState({ message: '', type: 'info' });
  const [homeAutoScroll, setHomeAutoScroll] = useState(false);
  const [isModalActive, setIsModalActive] = useState(false);
  const [postLoginRedirect, setPostLoginRedirect] = useState(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        return globalThis.localStorage.getItem('waterflow.postLoginScreen') || null;
      } catch {}
    }
    return null;
  });

  const showToast = (message, type = 'info') => {
    setGlobalToast({ message, type });
  };

  const [isOffline, setIsOffline] = useState(false);

  // Dynamic system navigation bar & accessibility mode detection (e.g., 3-button mode vs swipe gesture mode)
  const [navBarMetrics, setNavBarMetrics] = useState(() => {
    const window = Dimensions.get('window');
    const screen = Dimensions.get('screen');
    const statusBarHeight = RNStatusBar.currentHeight || 0;
    const systemNavHeight = Math.max(0, screen.height - window.height - statusBarHeight);
    const has3ButtonNav = systemNavHeight > 24;
    return {
      has3ButtonNav,
      systemNavHeight,
      bottomOffset: Platform.OS === 'android' ? Math.max(systemNavHeight + 10, 58) : Platform.OS === 'ios' ? 14 : 12,
    };
  });

  useEffect(() => {
    const updateMetrics = () => {
      const window = Dimensions.get('window');
      const screen = Dimensions.get('screen');
      const statusBarHeight = RNStatusBar.currentHeight || 0;
      const systemNavHeight = Math.max(0, screen.height - window.height - statusBarHeight);
      const has3ButtonNav = systemNavHeight > 24;
      setNavBarMetrics({
        has3ButtonNav,
        systemNavHeight,
        bottomOffset: Platform.OS === 'android' ? Math.max(systemNavHeight + 10, 58) : Platform.OS === 'ios' ? 14 : 12,
      });
    };
    const sub = Dimensions.addEventListener('change', updateMetrics);
    return () => sub?.remove();
  }, []);

  // Persistent tracking of notified order status transitions - GUARANTEES notifications fire only once per event!
  const notifiedOrderTransitions = useRef(new Set());

  const notifyOrderTransition = (order, isInitialPlacement = false) => {
    if (!order || !order.id) return;
    const orderId = String(order.id);
    const status = order.status || 'waiting_for_vendor';

    let eventKey = '';
    let title = '';
    let body = '';

    if (isInitialPlacement || status === 'waiting_for_vendor' || status === 'pending') {
      eventKey = `${orderId}:placed`;
      title = '💧 Order Placed Successfully';
      body = `${order.tankName || 'Water Tanker'} scheduled for ${order.deliveryDate || 'Today'}. Finding nearby verified suppliers.`;
    } else if (status === 'approved') {
      eventKey = `${orderId}:approved`;
      title = '✅ Booking Confirmed!';
      body = `${order.vendorName || 'Supplier'} has accepted your tanker booking. Delivery is being prepared.`;
    } else if (['no_vendor_available', 'rejected', 'cancelled'].includes(status)) {
      eventKey = `${orderId}:rejected`;
      title = status === 'no_vendor_available' ? '⚠️ No Vendor Available' : '❌ Booking Cancelled';
      body = status === 'no_vendor_available'
        ? 'No nearby supplier was available. Your payment refund has been initiated.'
        : 'Your tanker booking has been cancelled.';
    } else if (status === 'completed') {
      eventKey = `${orderId}:completed`;
      title = '🎉 Tanker Delivered!';
      body = `Your water delivery for ${order.tankName || 'Water Tanker'} has been completed successfully.`;
    }

    if (!eventKey || notifiedOrderTransitions.current.has(eventKey)) {
      return; // Already notified for this event, do NOT repeat!
    }

    notifiedOrderTransitions.current.add(eventKey);

    sendLocalNotification({
      title,
      body,
      data: { orderId, status },
    });
  };

  // Mobile Network Connectivity Listener
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setIsOffline(false);
        showToast('🟢 Back Online: Synced latest tankers.', 'success');
      };
      const handleOffline = () => {
        setIsOffline(true);
        showToast('⚡ Offline Mode: Reconnect to place orders.', 'error');
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Android Mobile Hardware Back Button Handler
  useEffect(() => {
    let lastBackTime = 0;
    const onHardwareBack = () => {
      if (isMenuOpen) {
        setIsMenuOpen(false);
        return true;
      }
      const isVendorUser = isLoggedIn && selectedLoginRole === 'vendor';
      const baseScreen = isVendorUser ? 'vendor-portal' : 'home';

      // If at role's root screen, prompt double-tap to exit app
      if (activeScreen === baseScreen || (isVendorUser && activeScreen === 'vendor-portal')) {
        const now = Date.now();
        if (now - lastBackTime < 2000) {
          return false; // Exit app
        }
        lastBackTime = now;
        showToast('Press back again to exit', 'info');
        return true;
      }

      // If we have history to pop
      if (screenHistory.length > 1) {
        goBack();
        return true;
      }

      // Fallback: stay on role base screen
      setActiveScreen(baseScreen);
      setScreenHistory([baseScreen]);
      return true;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSubscription.remove();
  }, [isMenuOpen, activeScreen, screenHistory, isLoggedIn, selectedLoginRole]);
  const [assignedDeliveries, setAssignedDeliveries] = useState([
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
    {
      id: 902,
      orderId: 'WT-1047',
      customer: 'Priya Nair',
      tank: 'Family 2000 L',
      status: 'Loaded',
      eta: '7:15 PM',
      driver: 'Ravi Singh',
      phone: '+91 99887 66554',
      location: '22, Koramangala, Bengaluru',
      progress: 46,
    },
  ]);
  const [vendorRequests] = useState([]);
  const [latestBookingStatus, setLatestBookingStatus] = useState(null);
  const [pushNotificationError, setPushNotificationError] = useState('');
  const [registeredPushToken, setRegisteredPushToken] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        globalThis.localStorage.setItem('waterflow.activeScreen', activeScreen);
        globalThis.localStorage.setItem('waterflow.vendorActiveTab', vendorActiveTab);
        globalThis.localStorage.setItem('waterflow.screenHistory', JSON.stringify(screenHistory));
        if (deliveryLocation) {
          globalThis.localStorage.setItem('waterflow.deliveryLocation', JSON.stringify(deliveryLocation));
        }
        if (selectedTank) {
          globalThis.localStorage.setItem('waterflow.selectedTank', JSON.stringify(selectedTank));
        }
        if (selectedOffer) {
          globalThis.localStorage.setItem('waterflow.selectedOffer', JSON.stringify(selectedOffer));
        }
      } catch {}
    }
  }, [activeScreen, vendorActiveTab, screenHistory, deliveryLocation, selectedTank, selectedOffer]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const user = await authApi.currentUser();
        if (!isMounted || !user) return;
        setIsLoggedIn(true);
        setCurrentUser(user);
        setSelectedLoginRole(user.role);
        if (user.role === 'vendor') {
          const savedTab = (Platform.OS === 'web' && globalThis.localStorage?.getItem('waterflow.vendorActiveTab')) || vendorActiveTab || 'overview';
          const savedScreen = (Platform.OS === 'web' && globalThis.localStorage?.getItem('waterflow.activeScreen')) || 'vendor-portal';
          setVendorActiveTab(savedTab);
          setActiveScreen(savedScreen === 'login' || savedScreen === 'signup' ? 'vendor-portal' : savedScreen);
        } else if (user.role === 'user') {
          const savedScreen = (Platform.OS === 'web' && globalThis.localStorage?.getItem('waterflow.activeScreen')) || activeScreen;
          if (savedScreen && !['login', 'signup'].includes(savedScreen)) {
            setActiveScreen(savedScreen);
          }
        }
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          await authApi.clearSession();
          if (Platform.OS === 'web' && globalThis.localStorage) {
            globalThis.localStorage.removeItem('waterflow.activeScreen');
            globalThis.localStorage.removeItem('waterflow.vendorActiveTab');
            globalThis.localStorage.removeItem('waterflow.screenHistory');
          }
        }
      }
    };

    restoreSession();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !['vendor', 'user'].includes(currentUser?.role) || Platform.OS === 'web') return undefined;
    let active = true;
    let responseSubscription;
    const openNotificationTarget = (response) => {
      if (!active) return;
      const target = response?.notification?.request?.content?.data?.screen;
      if (target === 'customer-orders') {
        setScreenHistory(['user-portal']);
        setActiveScreen('user-portal');
      } else {
        setVendorActiveTab('orders');
        setScreenHistory(['vendor-portal']);
        setActiveScreen('vendor-portal');
      }
      setIsMenuOpen(false);
    };

    const registerForOrderPushNotifications = async () => {
      try {
        if (!Device.isDevice) {
          throw new Error('Push notifications require a physical Android or iOS device.');
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId
          || Constants.easConfig?.projectId;
        if (!projectId) {
          throw new Error('Push notifications need an EAS project ID. Configure the Expo project and rebuild the app.');
        }

        if (Platform.OS === 'android' && currentUser.role === 'vendor') {
          await Notifications.setNotificationChannelAsync('orders', {
            name: 'New orders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 150, 250],
            lightColor: '#176bb1',
            sound: 'order_alert.wav',
          });
        }

        let permission = await Notifications.getPermissionsAsync();
        if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Allow notifications in device settings to receive new orders.');
        }

        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (currentUser.role === 'vendor') await vendorApi.registerPushToken(token);
        else await vendorApi.registerCustomerPushToken(token);
        if (active) {
          setRegisteredPushToken(token);
          setPushNotificationError('');
        }

        responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotificationTarget);
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          openNotificationTarget(lastResponse);
          await Notifications.clearLastNotificationResponseAsync();
        }
      } catch (error) {
        console.warn('Push notification notice:', error?.message);
        if (active) setPushNotificationError('');
      }
    };

    registerForOrderPushNotifications();
    return () => {
      active = false;
      responseSubscription?.remove();
    };
  }, [isLoggedIn, currentUser?.role]);

  const openScreen = (screen) => {
    triggerHaptic('light');
    if (screen === activeScreen) {
      setIsMenuOpen(false);
      return;
    }

    setScreenHistory((prev) => {
      if (screen === 'home') return ['home'];
      if (prev[prev.length - 1] === screen) return prev;
      return [...prev, screen];
    });
    setActiveScreen(screen);
    setIsMenuOpen(false);
  };

  const openVendorTab = (tab) => {
    triggerHaptic('light');
    setVendorActiveTab(tab);
    openScreen('vendor-portal');
  };

  const goBack = () => {
    triggerHaptic('light');
    const isVendorUser = isLoggedIn && selectedLoginRole === 'vendor';
    const baseScreen = isVendorUser ? 'vendor-portal' : 'home';
    setScreenHistory((prev) => {
      if (prev.length > 1) {
        const nextHistory = prev.slice(0, -1);
        const previousScreen = nextHistory[nextHistory.length - 1] || baseScreen;
        setActiveScreen(previousScreen);
        return nextHistory;
      }
      setActiveScreen(baseScreen);
      return [baseScreen];
    });
  };

  const handleLogin = async (arg1, arg2) => {
    const payload = typeof arg1 === 'string' && typeof arg2 === 'object'
      ? { ...arg2, role: arg1 }
      : (arg1 || {});
    const user = await authApi.login(payload);
    setIsLoggedIn(true);
    setCurrentUser(user);
    setSelectedLoginRole(user.role);

    if (user.role === 'vendor') {
      setVendorActiveTab('overview');
      setScreenHistory(['vendor-portal']);
      setActiveScreen('vendor-portal');
      setIsMenuOpen(false);
      return;
    }

    const redirectTarget = postLoginRedirect
      || (Platform.OS === 'web' && globalThis.localStorage?.getItem('waterflow.postLoginScreen'));
    if (redirectTarget) {
      setPostLoginRedirect(null);
      if (Platform.OS === 'web' && globalThis.localStorage) {
        try { globalThis.localStorage.removeItem('waterflow.postLoginScreen'); } catch {}
      }
      setScreenHistory((prev) => [...prev, redirectTarget]);
      setActiveScreen(redirectTarget);
      setIsMenuOpen(false);
      return;
    }

    setScreenHistory(['home']);
    setActiveScreen('home');
    setIsMenuOpen(false);
  };

  const handleSignUp = async (details) => {
    const registration = await authApi.register({ ...details, role: 'user' });
    const user = registration.user;
    setIsLoggedIn(true);
    setCurrentUser(user);
    setSelectedLoginRole(user.role);

    const redirectTarget = postLoginRedirect
      || (Platform.OS === 'web' && globalThis.localStorage?.getItem('waterflow.postLoginScreen'));
    if (redirectTarget) {
      setPostLoginRedirect(null);
      if (Platform.OS === 'web' && globalThis.localStorage) {
        try { globalThis.localStorage.removeItem('waterflow.postLoginScreen'); } catch {}
      }
      setScreenHistory((prev) => [...prev, redirectTarget]);
      setActiveScreen(redirectTarget);
      return;
    }

    setScreenHistory(['home']);
    setActiveScreen('home');
  };

  const handleLogout = async () => {
    if (registeredPushToken && ['vendor', 'user'].includes(currentUser?.role)) {
      try {
        if (currentUser.role === 'vendor') await vendorApi.unregisterPushToken(registeredPushToken);
        else await vendorApi.unregisterCustomerPushToken(registeredPushToken);
      } catch (error) {
        console.error('Unable to unregister push token during logout.', error);
      }
    }
    await authApi.clearSession();
    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        globalThis.localStorage.removeItem('waterflow.activeScreen');
        globalThis.localStorage.removeItem('waterflow.vendorActiveTab');
        globalThis.localStorage.removeItem('waterflow.screenHistory');
      } catch {}
    }
    setRegisteredPushToken('');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedLoginRole('user');
    setVendorActiveTab('overview');
    setScreenHistory(['home']);
    setActiveScreen('home');
    setIsMenuOpen(false);
  };

  const handleBookingRequest = async (request) => {
    const order = await vendorApi.createOrder({
      vendorId: request.vendorId,
      tankId: request.tankId,
      deliveryAddress: request.location,
      deliveryDate: request.day,
      deliveryTime: request.time,
    });
    setLatestBookingStatus({
      id: order.id,
      status: order.status,
      title: 'Booking sent to vendor',
      tank: `${request.tank.name} ${request.tank.liters}`,
      vendor: request.vendorName,
      eta: 'Waiting for vendor confirmation',
      location: request.location,
      payment: `Payment: ${order.paymentStatus}`,
      date: request.day,
      time: request.time,
    });
    notifyOrderTransition(order, true);
  };

  const handlePaymentComplete = (order, isInitial = false) => {
    const status = order.status || 'waiting_for_vendor';
    setLatestBookingStatus({
      id: order.id,
      status,
      title: status === 'approved' ? 'Booking confirmed'
        : status === 'no_vendor_available' ? 'No vendor accepted'
          : status === 'cancelled' ? 'Booking cancelled' : 'Finding a vendor',
      tank: `${order.tankName} ${order.capacityLiters} L`,
      vendor: order.vendorName || 'Finding a vendor',
      eta: status === 'approved' ? 'Vendor confirmed' : 'Waiting for vendor confirmation',
      location: order.deliveryAddress,
      payment: order.paymentStatus === 'refund_pending' ? 'Refund processing'
        : order.paymentStatus === 'refunded' ? 'Refunded'
          : `Paid ₹${Number(order.amount).toLocaleString('en-IN')}`,
      date: order.deliveryDate,
      time: order.deliveryTime,
    });
    notifyOrderTransition(order, isInitial);
  };

  const handleForgotPassword = (email) => {
    console.log('Reset link sent to:', email);
    setActiveScreen('otp-verification');
  };

  const handleResetPassword = (password, confirmPassword) => {
    if (password && password === confirmPassword) {
      setActiveScreen('otp-verification');
    }
  };

  const handleVerifyOtp = (otpCode) => {
    if (otpCode.length === 6) {
      setActiveScreen('reset-password');
    }
  };

  const showBottomNav = !isModalActive && !['login', 'signup', 'forgot-password', 'reset-password', 'otp-verification', 'booking'].includes(activeScreen);

  const renderBottomNav = () => {
    if (!showBottomNav) return null;

    const isVendor = isLoggedIn && selectedLoginRole === 'vendor';
    const navItems = isVendor
      ? [
          { label: 'Home', icon: 'home-outline', filledIcon: 'home', tab: 'overview' },
          { label: 'My Tankers', icon: 'car-outline', filledIcon: 'car', tab: 'inventory' },
          { label: 'Dashboard', icon: 'bar-chart-outline', filledIcon: 'bar-chart', tab: 'dashboard' },
          { label: 'Orders', icon: 'receipt-outline', filledIcon: 'receipt', tab: 'orders' },
        ]
      : [
          { label: 'Home', icon: 'home-outline', filledIcon: 'home', screen: 'home' },
          { label: 'Services', icon: 'grid-outline', filledIcon: 'grid', screen: 'services' },
          { label: 'Bookings', icon: 'calendar-outline', filledIcon: 'calendar', screen: 'my-bookings' },
          { label: 'Help', icon: 'help-circle-outline', filledIcon: 'help-circle', screen: 'support' },
        ];

    const customerActiveTab =
      activeScreen === 'home'
        ? 'Home'
        : activeScreen === 'services'
          ? 'Services'
          : (activeScreen === 'my-bookings' || activeScreen === 'booking')
            ? 'Bookings'
          : activeScreen === 'support'
            ? 'Help'
          : null;
    const activeTab = isVendor
      ? activeScreen === 'vendor-portal'
        ? navItems.find((item) => item.tab === vendorActiveTab)?.label
        : null
      : customerActiveTab;

    return (
      <View style={[styles.bottomNavWrap, { bottom: navBarMetrics.bottomOffset }]}>
        <View style={styles.bottomNav}>
          {navItems.map((item) => {
            const isActive = item.label === activeTab;

            return (
              <Pressable
                key={item.label}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => (isVendor ? openVendorTab(item.tab) : openScreen(item.screen))}
              >
                <Ionicons
                  name={isActive ? item.filledIcon : item.icon}
                  size={20}
                  color={isActive ? '#0284c7' : '#64748b'}
                  style={isActive ? styles.navIconActive : styles.navIconInactive}
                />
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'login':
        return (
          <LoginScreen
            onLogin={handleLogin}
            onGoToSignup={() => openScreen('signup')}
            onGoToBooking={() => openScreen('booking')}
            onGoToSupport={() => openScreen('support')}
            onForgotPassword={() => openScreen('forgot-password')}
            onGuestMode={() => openScreen('home')}
            onBack={() => openScreen('home')}
          />
        );
      case 'signup':
        return <SignUpScreen onSignUp={handleSignUp} onGoToLogin={() => openScreen('login')} />;
      case 'forgot-password':
        return (
          <ForgotPasswordScreen
            onSendResetLink={handleForgotPassword}
            onBackToLogin={() => openScreen('login')}
          />
        );
      case 'reset-password':
        return (
          <ResetPasswordScreen
            onResetPassword={handleResetPassword}
            onBackToLogin={() => openScreen('login')}
          />
        );
      case 'otp-verification':
        return (
          <OtpVerificationScreen
            onVerifyOtp={handleVerifyOtp}
            onBackToLogin={() => openScreen('login')}
            onResendOtp={() => console.log('OTP resent')}
          />
        );
      case 'booking':
        return (
          <BookingScreen
            setActiveScreen={openScreen}
            selectedTank={selectedTank}
            selectedOffer={selectedOffer}
            setSelectedTank={setSelectedTank}
            setSelectedOffer={setSelectedOffer}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            slots={slots}
            tankOptions={tankOptions}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
            onBookingRequest={handleBookingRequest}
            onPaymentComplete={handlePaymentComplete}
            latestBookingStatus={latestBookingStatus}
            deliveryLocation={deliveryLocation}
            setDeliveryLocation={setDeliveryLocation}
            showToast={showToast}
            onAddressChanged={() => setHomeAutoScroll(true)}
            onModalOpenChange={setIsModalActive}
            setPostLoginRedirect={(target) => {
              setPostLoginRedirect(target);
              if (Platform.OS === 'web' && globalThis.localStorage) {
                try { globalThis.localStorage.setItem('waterflow.postLoginScreen', target); } catch {}
              }
            }}
          />
        );
      case 'my-bookings':
        return (
          <MyBookingsScreen
            setActiveScreen={setActiveScreen}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
            latestBookingStatus={latestBookingStatus}
            onSelectTank={(tank) => {
              setSelectedTank(tank);
              setActiveScreen('booking');
            }}
          />
        );
      case 'services':
        return (
          <ServicesScreen
            setActiveScreen={openScreen}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
          />
        );
      case 'tracking':
        return (
          <TrackingScreen
            setActiveScreen={setActiveScreen}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
            mode="customer"
            deliveries={assignedDeliveries}
          />
        );
      case 'vendor-tracking':
        return (
          <TrackingScreen
            setActiveScreen={setActiveScreen}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
            mode="vendor"
            deliveries={assignedDeliveries}
          />
        );
      case 'support':
        return (
          <SupportScreen
            setActiveScreen={setActiveScreen}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
          />
        );
      case 'my-profile':
      case 'user-portal':
        return (
          <MyProfileScreen
            role={selectedLoginRole || currentUser?.role || 'user'}
            currentUser={currentUser}
            isLoggedIn={isLoggedIn}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={goBack}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onGoToLogin={() => openScreen('login')}
            onNavigate={(screen, tab) => (tab ? openVendorTab(tab) : openScreen(screen))}
          />
        );
      case 'terms':
        return (
          <TermsScreen
            onBackPress={goBack}
            onOpenMenu={() => setIsMenuOpen(true)}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
          />
        );
      case 'privacy':
        return (
          <PrivacyScreen
            onBackPress={goBack}
            onOpenMenu={() => setIsMenuOpen(true)}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
          />
        );
      case 'vendor-portal':
        return (
          <PortalScreen
            role="vendor"
            requests={vendorRequests}
            currentUser={currentUser}
            activeVendorTab={vendorActiveTab}
            onVendorTabChange={setVendorActiveTab}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={selectedLoginRole === 'vendor' ? undefined : goBack}
            pushNotificationError={pushNotificationError}
            onModalOpenChange={setIsModalActive}
            onLogout={handleLogout}
          />
        );
      case 'home':
      default:
        return (
          <HomeScreen
            setActiveScreen={openScreen}
            selectedTank={selectedTank}
            setSelectedTank={setSelectedTank}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            tankOptions={tankOptions}
            slots={slots}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onOpenMenu={() => setIsMenuOpen(true)}
            onBackPress={undefined}
            deliveryLocation={deliveryLocation}
            setDeliveryLocation={setDeliveryLocation}
            onSelectOffer={setSelectedOffer}
            autoScrollToOffers={homeAutoScroll}
            onResetAutoScroll={() => setHomeAutoScroll(false)}
            onModalOpenChange={setIsModalActive}
          />
        );
    }
  };

  if (isSplashVisible) {
    return <SplashScreen onFinish={() => setIsSplashVisible(false)} />;
  }

  return (
    <View style={styles.appRoot}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={activeScreen === 'home' ? 'light' : 'dark'} />

        {globalToast?.message ? (
          <Toast
            message={globalToast.message}
            type={globalToast.type || 'info'}
            onDismiss={() => setGlobalToast({ message: '', type: 'info' })}
          />
        ) : null}

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>Offline Mode: Showing cached details</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.contentArea,
            activeScreen !== 'home' && {
              paddingTop: Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 36) : Platform.OS === 'ios' ? 48 : 16,
            },
          ]}
        >
          <Suspense fallback={<ScreenLoadingFallback screenName={activeScreen} />}>
            {renderScreen()}
          </Suspense>
        </View>
        {renderBottomNav()}
      </SafeAreaView>

      <AppMenu
        isOpen={isMenuOpen}
        isLoggedIn={isLoggedIn}
        loginRole={selectedLoginRole}
        currentUser={currentUser}
        onClose={() => setIsMenuOpen(false)}
        onSelect={(screen) => {
          const vendorTabByScreen = {
            'vendor-portal': 'overview',
            'vendor-orders': 'orders',
            'vendor-dashboard': 'dashboard',
            'vendor-inventory': 'inventory',
            'vendor-profile': 'profile',
          };
          if (vendorTabByScreen[screen]) {
            openVendorTab(vendorTabByScreen[screen]);
            return;
          }
          openScreen(screen);
        }}
        onLoginToggle={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#F5F9FD',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 45px -15px rgba(7, 81, 168, 0.15), 0 0 1px 1px rgba(7, 81, 168, 0.05)',
      },
    }),
  },
  contentArea: {
    flex: 1,
    width: '100%',
  },
  bottomNavWrap: {
    position: 'absolute',
    left: '3%',
    width: '94%',
    bottom: Platform.OS === 'android' ? 58 : 12,
  },
  bottomNav: {
    height: 68,
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#0751A8',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  navItem: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    gap: 2,
    paddingHorizontal: 4,
  },
  navItemActive: {
    backgroundColor: '#0751A8',
    shadowColor: '#0751A8',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  navIconInactive: {
    opacity: 0.8,
  },
  navIconActive: {
    color: '#ffffff',
  },
  navText: {
    ...TYPOGRAPHY.navLabel,
    color: '#64748B',
  },
  navTextActive: {
    ...TYPOGRAPHY.navLabel,
    color: '#ffffff',
    fontFamily: fontFamilies.bold,
  },
  offlineBanner: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  offlineBannerText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
});
