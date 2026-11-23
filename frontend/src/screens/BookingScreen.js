import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Toast from '../components/Toast';
import { vendorApi } from '../authApi';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';
import ShareOrderModal from '../components/ShareOrderModal';

function formatAddress(address = {}) {
  const street = address.road || address.pedestrian || address.residential || address.footway;
  const houseAndStreet = street ? [address.house_number, street].filter(Boolean).join(', ') : null;
  const locality = address.neighbourhood || address.suburb || address.quarter;
  const city = address.city || address.town || address.village || address.municipality;
  return [...new Set([
    houseAndStreet,
    locality,
    address.suburb,
    city,
    address.postcode,
    address.state,
    address.country,
  ].filter(Boolean))].join(', ');
}

async function resolveAddressFromCoords(latitude, longitude) {
  try {
    const nativeResults = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (Array.isArray(nativeResults) && nativeResults.length > 0) {
      const item = nativeResults[0];
      const addressParts = [
        item.name && item.name !== item.street ? item.name : null,
        item.street,
        item.subregion || item.district || item.city,
        item.city && item.city !== (item.subregion || item.district) ? item.city : null,
        item.region,
        item.postalCode,
      ].filter(Boolean);
      const built = [...new Set(addressParts)].join(', ');
      if (built && built.length > 3) return built;
    }
  } catch {}

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'BHAGIRA-WaterApp/1.0 (contact: support@bhagira.com)',
        },
      }
    );
    if (response.ok) {
      const data = await response.json();
      const addr = formatAddress(data.address) || data.display_name;
      if (addr) return addr;
    }
  } catch {}

  return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
}

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

const dayOptions = ['Today', 'Tomorrow', 'Day after'];
const timeOptions = ['4:30 PM', '6:00 PM', '9:00 AM', '1:00 PM'];
const summaryTimeSlots = [
  '9:00 AM – 11:00 AM',
  '11:00 AM – 1:00 PM',
  '2:00 PM – 4:00 PM',
  '4:00 PM – 6:00 PM',
];

function getSummaryDayOptions() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 4 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() + index);
    const dayName = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : daysOfWeek[d.getDay()];
    const dateFormatted = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
    return {
      key: `${dayName}, ${dateFormatted}`,
      day: dayName,
      date: dateFormatted,
    };
  });
}

async function loadRazorpayCheckout() {
  if (globalThis.Razorpay) return globalThis.Razorpay;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout. Check your internet connection and try again.'));
    document.body.appendChild(script);
  });
  if (!globalThis.Razorpay) throw new Error('Razorpay Checkout could not be initialized.');
  return globalThis.Razorpay;
}

async function openRazorpayCheckout(options) {
  if (Platform.OS !== 'web') {
    const razorpayModule = await import('react-native-razorpay');
    const razorpay = razorpayModule.default || razorpayModule;
    return razorpay.open(options);
  }

  const Razorpay = await loadRazorpayCheckout();
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      ...options,
      handler: resolve,
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled. You can try again when ready.')),
      },
    });
    checkout.on('payment.failed', (event) => {
      reject(new Error(event.error?.description || 'Razorpay could not complete this payment. Please try another payment method.'));
    });
    checkout.open();
  });
}

export default function BookingScreen({
  setActiveScreen,
  selectedTank,
  selectedOffer,
  setSelectedTank,
  setSelectedOffer,
  selectedSlot,
  setSelectedSlot,
  slots,
  isLoggedIn,
  currentUser,
  onOpenMenu,
  onBackPress,
  latestBookingStatus,
  deliveryLocation,
  setDeliveryLocation,
  onPaymentComplete,
  showToast,
  onAddressChanged,
  setPostLoginRedirect,
  onModalOpenChange,
}) {
  const [step, setStep] = useState(() => (Platform.OS === 'web' && globalThis.localStorage?.getItem('waterflow.bookingStep')) || 'summary');
  const [selectedDay, setSelectedDay] = useState('Today');
  const [selectedTime, setSelectedTime] = useState('QuickTap Within 3 Hrs');
  const [location, setLocation] = useState(deliveryLocation?.address || '');
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    onModalOpenChange?.(showAddressModal);
  }, [showAddressModal]);
  const [addressDraft, setAddressDraft] = useState(deliveryLocation?.address || '');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const searchVersionRef = useRef(0);

  // Debounced address search as user types
  useEffect(() => {
    if (!showAddressModal) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return undefined;
    }

    const query = addressDraft.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return undefined;
    }

    searchVersionRef.current += 1;
    const currentVersion = searchVersionRef.current;
    setIsSearchingAddress(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          addressdetails: '1',
          limit: '5',
          q: query,
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'BHAGIRA-WaterApp/1.0 (contact: support@bhagira.com)',
          },
        });
        if (!res.ok) throw new Error('Search failed');
        const results = await res.json();
        if (currentVersion === searchVersionRef.current) {
          setAddressSuggestions(Array.isArray(results) ? results : []);
        }
      } catch (err) {
        if (currentVersion === searchVersionRef.current) {
          setAddressSuggestions([]);
        }
      } finally {
        if (currentVersion === searchVersionRef.current) {
          setIsSearchingAddress(false);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [addressDraft, showAddressModal]);

  const isSameLocation = (newAddr, newLat, newLon) => {
    const prevAddr = (deliveryLocation?.address || location || '').trim();
    const clean = (str) =>
      (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanNew = clean(newAddr);
    const cleanPrev = clean(prevAddr);

    if (cleanNew && cleanPrev && cleanNew === cleanPrev) {
      return true;
    }

    const prevLat = Number(deliveryLocation?.latitude);
    const prevLon = Number(deliveryLocation?.longitude);
    const parsedLat = Number(newLat);
    const parsedLon = Number(newLon);

    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(prevLat) &&
      Number.isFinite(parsedLon) &&
      Number.isFinite(prevLon)
    ) {
      const latDiff = Math.abs(parsedLat - prevLat);
      const lonDiff = Math.abs(parsedLon - prevLon);
      // within ~40-50m
      if (latDiff < 0.0004 && lonDiff < 0.0004) {
        return true;
      }
    }

    return false;
  };

  const handleSelectSuggestion = (item) => {
    const formatted = formatAddress(item.address) || item.display_name;
    const lat = Number(item.lat);
    const lon = Number(item.lon);

    if (isSameLocation(formatted, lat, lon)) {
      setShowAddressModal(false);
      setAddressSuggestions([]);
      if (showToast) {
        showToast('Same location selected, keeping current booking', 'info');
      }
      return;
    }

    setLocation(formatted);
    setAddressDraft(formatted);
    setAddressSuggestions([]);
    setShowAddressModal(false);

    const newLoc = {
      address: formatted,
      latitude: Number.isFinite(lat) ? lat : deliveryLocation?.latitude,
      longitude: Number.isFinite(lon) ? lon : deliveryLocation?.longitude,
    };

    if (setDeliveryLocation) {
      setDeliveryLocation(newLoc);
    }

    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        globalThis.localStorage.setItem('waterflow.deliveryLocation', JSON.stringify(newLoc));
      } catch {}
    }

    setSelectedOffer?.(null);
    onAddressChanged?.();
    if (showToast) {
      showToast('Address changed, please select the tank again', 'info');
    }
    setActiveScreen('home');
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission is required to detect your current location.');
        setIsLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const addr = await resolveAddressFromCoords(lat, lon);

      if (isSameLocation(addr, lat, lon)) {
        setShowAddressModal(false);
        setAddressSuggestions([]);
        if (showToast) {
          showToast('Same location detected, keeping current booking', 'info');
        }
        return;
      }

      setLocation(addr);
      setAddressDraft(addr);
      const newLoc = { latitude: lat, longitude: lon, address: addr };
      if (setDeliveryLocation) {
        setDeliveryLocation(newLoc);
      }
      if (Platform.OS === 'web' && globalThis.localStorage) {
        try {
          globalThis.localStorage.setItem('waterflow.deliveryLocation', JSON.stringify(newLoc));
        } catch {}
      }
      setShowAddressModal(false);
      setSelectedOffer?.(null);
      onAddressChanged?.();
      if (showToast) {
        showToast('Address changed, please select the tank again', 'info');
      }
      setActiveScreen('home');
    } catch (err) {
      alert('Unable to get current location: ' + err.message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirmCustomAddress = async () => {
    const newAddr = addressDraft.trim();
    if (!newAddr) return;

    let lat = deliveryLocation?.latitude;
    let lon = deliveryLocation?.longitude;

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        q: newAddr,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'BHAGIRA-WaterApp/1.0 (contact: support@bhagira.com)',
        },
      });
      if (res.ok) {
        const results = await res.json();
        if (results && results[0]) {
          lat = Number(results[0].lat);
          lon = Number(results[0].lon);
        }
      }
    } catch {}

    if (isSameLocation(newAddr, lat, lon)) {
      setShowAddressModal(false);
      setAddressSuggestions([]);
      if (showToast) {
        showToast('Same location entered, keeping current booking', 'info');
      }
      return;
    }

    setLocation(newAddr);
    const newLoc = {
      address: newAddr,
      latitude: lat,
      longitude: lon,
    };
    if (setDeliveryLocation) {
      setDeliveryLocation(newLoc);
    }
    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        globalThis.localStorage.setItem('waterflow.deliveryLocation', JSON.stringify(newLoc));
      } catch {}
    }

    setShowAddressModal(false);
    setSelectedOffer?.(null);
    onAddressChanged?.();
    if (showToast) {
      showToast('Address changed, please select the tank again', 'info');
    }
    setActiveScreen('home');
  };
  const [doorNo, setDoorNo] = useState(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      return globalThis.localStorage.getItem('waterflow.doorNo') || '';
    }
    return '';
  });
  const [landmark, setLandmark] = useState(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      return globalThis.localStorage.getItem('waterflow.landmark') || '';
    }
    return '';
  });
  const [summaryError, setSummaryError] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [paidOrder, setPaidOrder] = useState(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        const stored = globalThis.localStorage.getItem('waterflow.paidOrder');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return null;
  });
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [approvalState, setApprovalState] = useState('pending');
  const [remainingVendors] = useState([]);
  const [tankOffers, setTankOffers] = useState([]);
  const [isLoadingTankOffers, setIsLoadingTankOffers] = useState(false);
  const [tankOffersError, setTankOffersError] = useState('');
  const [chosenOffer, setChosenOffer] = useState(selectedOffer || null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      try {
        globalThis.localStorage.setItem('waterflow.doorNo', doorNo);
        globalThis.localStorage.setItem('waterflow.landmark', landmark);
      } catch {}
    }
  }, [doorNo, landmark]);

  useEffect(() => {
    if (deliveryLocation?.address) {
      setLocation(deliveryLocation.address);
      setAddressDraft(deliveryLocation.address);
    }
  }, [deliveryLocation?.address]);

  useEffect(() => {
    if (selectedOffer && (!chosenOffer || chosenOffer.capacityLiters !== selectedOffer.capacityLiters)) {
      setChosenOffer(selectedOffer);
    }
  }, [selectedOffer]);

  const activeOffer = chosenOffer || selectedOffer;
  const tankOffersCapacity = tankOffers.find((offer) => (
    Number(offer.capacityLiters) === Number(activeOffer?.capacityLiters || activeOffer?.tank?.capacityLiters)
  ));
  const selectedVariant = tankOffersCapacity
    || (activeOffer?.displayedPrice !== undefined ? activeOffer : null);

  useEffect(() => {
    if (chosenOffer || tankOffers.length === 0) return;
    const selectedCapacity = Number(String(selectedTank?.liters || '').replace(/[^\d]/g, ''));
    const defaultVariant = tankOffers.find((offer) => offer.capacityLiters === selectedCapacity) || (activeOffer ? null : tankOffers[0]);
    if (defaultVariant) {
      setChosenOffer(defaultVariant);
      setSelectedTank({
        id: defaultVariant.capacityLiters,
        name: defaultVariant.name,
        liters: `${defaultVariant.capacityLiters} L`,
        price: `₹${Number(defaultVariant.displayedPrice).toLocaleString('en-IN')}`,
        badge: `${defaultVariant.vendorsCount || 0} nearby vendors`,
      });
    }
  }, [tankOffers, chosenOffer, activeOffer, selectedTank?.liters, setSelectedTank]);

  useEffect(() => {
    let active = true;
    if (!deliveryLocation
      || !Number.isFinite(deliveryLocation.latitude)
      || !Number.isFinite(deliveryLocation.longitude)) {
      setTankOffers([]);
      setTankOffersError('');
      setIsLoadingTankOffers(false);
      return () => { active = false; };
    }

    setTankOffers([]);
    setIsLoadingTankOffers(true);
    setTankOffersError('');
    vendorApi.nearbyOffers({
      latitude: deliveryLocation.latitude,
      longitude: deliveryLocation.longitude,
    }).then((offers) => {
      if (active) setTankOffers(offers);
    }).catch((error) => {
      if (active) setTankOffersError(error.message || 'Unable to load nearby tank offers.');
    }).finally(() => {
      if (active) setIsLoadingTankOffers(false);
    });

    return () => { active = false; };
  }, [deliveryLocation?.latitude, deliveryLocation?.longitude]);

  const previousStatusRef = useRef(paidOrder?.status);

  useEffect(() => {
    if (step !== 'success' || !paidOrder?.id) return undefined;
    let active = true;
    const refreshStatus = async () => {
      try {
        const orders = await vendorApi.customerOrders();
        const latestOrder = orders.find((order) => order.id === paidOrder.id);
        if (active && latestOrder) {
          const statusChanged = latestOrder.status !== previousStatusRef.current;
          setPaidOrder(latestOrder);
          if (statusChanged) {
            previousStatusRef.current = latestOrder.status;
            onPaymentComplete?.(latestOrder);
          }
        }
      } catch (error) {
        if (active) setSummaryError(error.message || 'Unable to refresh your booking status.');
      }
    };
    refreshStatus();
    const intervalId = setInterval(refreshStatus, 10000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [step, paidOrder?.id]);

  const goToNextStep = () => {
    if (step === 'tank') setStep('location');
    else if (step === 'location') setStep('vendors');
    else if (step === 'vendors') setStep('approval');
    else if (step === 'approval' && approvalState === 'pending') setStep('payment');
  };

  const price = Number(
    selectedVariant?.displayedPrice
    ?? chosenOffer?.displayedPrice
    ?? selectedOffer?.displayedPrice
    ?? (selectedTank?.price || '0').replace(/[^\d.]/g, '')
  );
  const formattedPrice = `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const summaryDayOptions = getSummaryDayOptions();
  const hasDeliveryAddress = Boolean(location.trim());

  const verifyCompletedPayment = async (payment) => {
    setIsProcessingPayment(true);
    setSummaryError('');
    try {
      const result = await vendorApi.verifyRazorpayPayment(payment);
      setPaidOrder(result.order);
      setPendingPayment(null);
      setStep('success');
      previousStatusRef.current = result.order?.status;
      onPaymentComplete?.(result.order, true);
    } catch (error) {
      setPendingPayment(payment);
      setSummaryError(`Payment was submitted, but we couldn't confirm it yet. Do not pay again. Retry payment verification or contact support. ${error.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStartCheckout = async () => {
    setSummaryError('');
    if (!isLoggedIn) {
      if (showToast) {
        showToast('Please sign in to complete your water booking payment', 'info');
      }
      setPostLoginRedirect?.('booking');
      setActiveScreen('login');
      return;
    }
    if (!selectedVariant?.capacityLiters) {
      setSummaryError('Choose an available tanker variant within 10 km before continuing to payment.');
      return;
    }
    if (!Number.isFinite(deliveryLocation?.latitude) || !Number.isFinite(deliveryLocation?.longitude)) {
      setSummaryError('Select your delivery location again before continuing to payment.');
      return;
    }
    const addressParts = [];
    if (doorNo.trim()) addressParts.push(`Door No: ${doorNo.trim()}`);
    if (landmark.trim()) addressParts.push(`Landmark: ${landmark.trim()}`);
    if (location.trim()) addressParts.push(location.trim());
    const deliveryAddress = addressParts.join(', ');
    if (deliveryAddress.length < 5) {
      setSummaryError('Enter a complete delivery address before continuing.');
      return;
    }
    if (pendingPayment) {
      await verifyCompletedPayment(pendingPayment);
      return;
    }

    setIsProcessingPayment(true);
    try {
      const checkout = await vendorApi.createRazorpayOrder({
        capacityLiters: selectedVariant.capacityLiters,
        displayedPrice: selectedVariant.displayedPrice,
        latitude: deliveryLocation.latitude,
        longitude: deliveryLocation.longitude,
        deliveryAddress,
        deliveryDate: selectedDay,
        deliveryTime: selectedTime,
      });
      setSelectedSlot(`${selectedDay}, ${selectedTime}`);
      const payment = await openRazorpayCheckout({
        key: checkout.keyId,
        amount: String(checkout.order.amount),
        currency: checkout.order.currency,
        order_id: checkout.order.id,
        name: 'BHAGIRA',
        description: `${checkout.tank.name} · ${Number(checkout.tank.capacityLiters).toLocaleString('en-IN')} L`,
        prefill: checkout.customer,
        theme: { color: '#0284c7' },
        retry: { enabled: true, max_count: 2 },
      });
      setPendingPayment(payment);
      await verifyCompletedPayment(payment);
    } catch (error) {
      if (error.code === 'OFFER_PRICE_CHANGED') {
        try {
          const offers = await vendorApi.nearbyOffers({
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude,
          });
          setTankOffers(offers);
          const updatedOffer = offers.find(
            (offer) => Number(offer.capacityLiters) === Number(selectedVariant.capacityLiters)
          );
          if (updatedOffer) {
            setChosenOffer(updatedOffer);
            setSelectedTank({
              id: updatedOffer.capacityLiters,
              name: updatedOffer.name,
              liters: `${updatedOffer.capacityLiters} L`,
              price: `₹${Number(updatedOffer.displayedPrice).toLocaleString('en-IN')}`,
              badge: `${updatedOffer.vendorsCount || 0} nearby vendors`,
            });
            setSummaryError('The price changed. Review the updated price and proceed to pay again.');
          } else {
            setChosenOffer({ capacityLiters: selectedVariant.capacityLiters });
            setSummaryError('This tanker variant is no longer available nearby. Choose a different variant.');
          }
        } catch (refreshError) {
          setSummaryError(refreshError.message || 'The offer price changed, but updated offers could not be loaded.');
        }
      } else {
        setSummaryError(error.message || 'Unable to start Razorpay Checkout. Please try again.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const renderBookingSummary = () => {
    const capacityNum = selectedVariant?.capacityLiters || chosenOffer?.capacityLiters || selectedOffer?.capacityLiters || Number((selectedTank?.liters || '').replace(/[^\d]/g, '')) || 1000;

    return (
      <>
        <View style={styles.summaryHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBackPress}
            style={styles.summaryBackButton}
          >
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.summaryHeaderTitle}>Booking Summary</Text>
          <View style={styles.summaryHeaderSpacer} />
        </View>

        {/* Selected Water Tanker Card - Image 1 Style */}
        <View style={styles.productCard}>
          <View style={styles.tankerImgWrap}>
            <Image
              source={getTankerImage(capacityNum)}
              style={styles.tankerImg}
              resizeMode="contain"
            />
            {!tankerTruckImages[capacityNum] ? (
              <View style={styles.tankTextOverlay}>
                <Text style={styles.tankLitresText}>
                  {capacityNum >= 1000 ? `${(capacityNum / 1000).toLocaleString('en-IN')}k L` : `${capacityNum} L`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productTitle}>{Number(capacityNum).toLocaleString('en-IN')} L Tanker</Text>
            <View style={styles.productDetailRow}>
              <Ionicons name="cube-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.productCapacity}>Capacity: {Number(capacityNum).toLocaleString('en-IN')} LTR</Text>
            </View>
            <View style={styles.productDetailRow}>
              <Ionicons name="pricetag-outline" size={15} color="#0751A8" style={{ marginRight: 6 }} />
              <Text style={styles.productPrice}>Price: {formattedPrice}</Text>
            </View>
          </View>
        </View>

        {/* Service Address Card - Image 1 Style */}
        <View style={styles.bookingSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="location" size={20} color="#0751A8" style={{ marginRight: 8 }} />
            <Text style={styles.sectionHeading}>Service Address</Text>
          </View>

          {/* Current Address with Edit Button that opens Pop-up */}
          <View style={styles.addressBox}>
            <Ionicons name="location" size={18} color="#0751A8" style={{ marginTop: 2, marginRight: 8 }} />
            <Text style={styles.currentAddressText} numberOfLines={2}>
              {location || 'Location not selected'}
            </Text>
            <Pressable
              style={styles.editAddressButton}
              onPress={() => {
                setAddressDraft(location);
                setAddressSuggestions([]);
                setShowAddressModal(true);
              }}
            >
              <Ionicons name="pencil" size={13} color="#0751A8" style={{ marginRight: 3 }} />
              <Text style={styles.editAddressText}>Edit</Text>
            </Pressable>
          </View>

          {/* Door No. Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputGroupLabel}>House / Flat / Door No. (Optional)</Text>
            <View style={styles.inputFieldContainer}>
              <Ionicons name="home-outline" size={18} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                accessibilityLabel="House, Flat, or Door Number"
                style={styles.inputField}
                value={doorNo}
                onChangeText={(value) => {
                  setDoorNo(value);
                  setSummaryError('');
                }}
                placeholder="e.g. Flat 402, House No. 12-34, Block B"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Landmark Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputGroupLabel}>Nearby Landmark (Optional)</Text>
            <View style={styles.inputFieldContainer}>
              <Ionicons name="navigate-outline" size={18} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                accessibilityLabel="Nearby Landmark"
                style={styles.inputField}
                value={landmark}
                onChangeText={(value) => {
                  setLandmark(value);
                  setSummaryError('');
                }}
                placeholder="e.g. Near Apollo Pharmacy, Opp. Water Tank"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>

        {/* Choose Preferred Slot Card - Image 1 Style */}
        <View style={styles.bookingSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="calendar" size={19} color="#0751A8" style={{ marginRight: 8 }} />
            <Text style={styles.sectionHeading}>Choose Preferred Slot</Text>
          </View>

          {/* Horizontal Date Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayOptionsWrap}>
            {summaryDayOptions.map((item) => {
              const isSelected = selectedDay === item.day || selectedDay === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.dayChip, isSelected && styles.dayChipActive]}
                  onPress={() => {
                    setSelectedDay(item.day);
                    setSelectedSlot(`${item.day}, ${selectedTime}`);
                  }}
                >
                  <Text style={[styles.dayChipTitle, isSelected && styles.dayChipTitleActive]}>
                    {item.day}
                  </Text>
                  <Text style={[styles.dayChipSubtitle, isSelected && styles.dayChipSubtitleActive]}>
                    {item.date}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 2-Column Time Slots */}
          <View style={styles.timeSlotsGrid}>
            {summaryTimeSlots.map((time) => {
              const isSelected = selectedTime === time;
              return (
                <Pressable
                  key={time}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.timeSlotCard, isSelected && styles.timeSlotCardActive]}
                  onPress={() => {
                    setSelectedTime(time);
                    setSelectedSlot(`${selectedDay}, ${time}`);
                  }}
                >
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={isSelected ? '#0751A8' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextActive]}>
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Terms & Conditions Checkbox */}
          <View style={styles.termsRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreedToTerms }}
              onPress={() => setAgreedToTerms((agreed) => !agreed)}
              hitSlop={8}
            >
              <View style={[styles.termsCheckbox, agreedToTerms && styles.termsCheckboxChecked]}>
                {agreedToTerms ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
              </View>
            </Pressable>
            <Text style={styles.termsText}>
              <Text onPress={() => setAgreedToTerms((agreed) => !agreed)}>I agree to the </Text>
              <Text
                style={styles.termsLink}
                onPress={() => setActiveScreen('privacy')}
              >
                Privacy Policy
              </Text>
              <Text onPress={() => setAgreedToTerms((agreed) => !agreed)}> & </Text>
              <Text
                style={styles.termsLink}
                onPress={() => setActiveScreen('terms')}
              >
                Terms of Service
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.promoSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isPromoOpen }}
            style={styles.promoButton}
            onPress={() => setIsPromoOpen((isOpen) => !isOpen)}
          >
            <Ionicons name="pricetag" size={20} color="#0751A8" />
            <Text style={styles.promoButtonText}>Apply Promo Code</Text>
            <Ionicons name={isPromoOpen ? 'chevron-up' : 'chevron-forward'} size={18} color="#0f172a" />
          </Pressable>
          {isPromoOpen ? (
            <View style={styles.promoEntry}>
              <TextInput
                accessibilityLabel="Promo code"
                style={styles.promoInput}
                value={promoCode}
                onChangeText={(value) => {
                  setPromoCode(value);
                  setPromoMessage('');
                }}
                placeholder="Enter promo code"
                autoCapitalize="characters"
              />
              <Pressable
                style={styles.promoApplyButton}
                onPress={() => setPromoMessage(
                  promoCode.trim()
                    ? 'Promo codes are not available yet.'
                    : 'Enter a promo code first.'
                )}
              >
                <Text style={styles.promoApplyText}>Apply</Text>
              </Pressable>
              {promoMessage ? <Text style={styles.promoMessage}>{promoMessage}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.footerSpacer} />
      </>
    );
  };

  const renderSummaryFooter = () => (
    <View style={styles.summaryFooter}>
      <View style={styles.footerActions}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalPrice}>{formattedPrice}</Text>
          <Text style={styles.footerTotalLabel}>Total Amount</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !agreedToTerms || !hasDeliveryAddress || !selectedVariant || isProcessingPayment }}
          disabled={!agreedToTerms || !hasDeliveryAddress || !selectedVariant || isProcessingPayment}
          style={[styles.proceedButton, (!agreedToTerms || !hasDeliveryAddress || !selectedVariant || isProcessingPayment) && styles.proceedButtonDisabled]}
          onPress={handleStartCheckout}
        >
          {isProcessingPayment ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.proceedButtonContent}>
              <Text style={styles.proceedButtonText}>
                {pendingPayment ? 'Verify Payment' : 'Proceed to Pay'}
              </Text>
              <Ionicons name="arrow-forward" size={17} color="#ffffff" style={{ marginLeft: 6 }} />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );

  const renderSummary = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Selected tank</Text>
        <Text style={styles.summaryValue}>{selectedTank.name} {selectedTank.liters}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Vendor</Text>
        <Text style={styles.summaryValue}>{selectedVariant ? 'Nearest eligible vendor contacted first' : 'Choose a tanker variant'}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Day</Text>
        <Text style={styles.summaryValue}>{selectedDay}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Preferred time</Text>
        <Text style={styles.summaryValue}>{selectedTime}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Location</Text>
        <Text style={styles.summaryValue}>{location}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Estimated total</Text>
        <Text style={[styles.summaryValue, styles.summaryAmount]}>{formattedPrice}</Text>
      </View>
    </View>
  );

  const renderTankStep = () => (
    <View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Available tanks near you</Text>
          <Text style={styles.offerRadiusCaption}>
            {deliveryLocation ? 'Choose an available tank near your delivery location' : 'Set your delivery location to find available tanks'}
          </Text>
        </View>
      </View>

      {isLoadingTankOffers ? (
        <View style={styles.tankOffersState}>
          <ActivityIndicator color="#0284c7" />
          <Text style={styles.tankOffersStateText}>Finding available tanks nearby…</Text>
        </View>
      ) : null}
      {!isLoadingTankOffers && tankOffersError ? <Text style={styles.tankOffersError}>{tankOffersError}</Text> : null}
      {!isLoadingTankOffers && !tankOffersError && !deliveryLocation ? (
        <View style={styles.tankOffersState}>
          <Text style={styles.tankOffersStateText}>Return to the home page and select or enter your delivery location.</Text>
        </View>
      ) : null}
      {!isLoadingTankOffers && !tankOffersError && deliveryLocation && tankOffers.length === 0 ? (
        <View style={styles.tankOffersState}>
          <Text style={styles.tankOffersStateText}>No available tanks found near your location.</Text>
        </View>
      ) : null}

      {tankOffers.map((offer) => {
        const isSelected = selectedVariant?.capacityLiters === offer.capacityLiters;
        return (
          <Pressable
            key={offer.capacityLiters}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[styles.tankOfferCard, isSelected && styles.tankOfferCardSelected]}
            onPress={() => {
              setSelectedTank({
                id: offer.capacityLiters,
                name: offer.name,
                liters: `${offer.capacityLiters} L`,
                price: `₹${Number(offer.displayedPrice).toLocaleString('en-IN')}`,
                badge: `${offer.vendorsCount || 0} nearby vendors`,
              });
              setChosenOffer(offer);
            }}
          >
            <View style={styles.tankOfferDetails}>
              <Text style={styles.tankName}>{offer.name}</Text>
              <Text style={styles.tankVolume}>{Number(offer.capacityLiters).toLocaleString('en-IN')} L</Text>
              <Text style={styles.tankPrice}>₹{Number(offer.displayedPrice).toLocaleString('en-IN')}</Text>
              <Text style={styles.tankBadge}>Highest available price · {offer.vendorsCount || 0} eligible vendors</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.bookingCard}>
        <Text style={styles.sectionTitle}>Preferred day & time</Text>

        <Text style={styles.fieldLabel}>Day</Text>
        <View style={styles.optionRow}>
          {dayOptions.map((day) => (
            <Pressable
              key={day}
              style={[styles.optionButton, selectedDay === day && styles.optionButtonActive]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.optionText, selectedDay === day && styles.optionTextActive]}>{day}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.fieldLabel, styles.mt16]}>Time slot</Text>
        <View style={styles.optionRow}>
          {timeOptions.map((time) => (
            <Pressable
              key={time}
              style={[styles.optionButton, selectedTime === time && styles.optionButtonActive]}
              onPress={() => setSelectedTime(time)}
            >
              <Text style={[styles.optionText, selectedTime === time && styles.optionTextActive]}>{time}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {renderSummary()}

      <Pressable style={styles.primaryButton} onPress={goToNextStep}>
        <Text style={styles.primaryButtonText}>Continue to location</Text>
      </Pressable>
    </View>
  );

  const renderLocationStep = () => (
    <View>
      <View style={styles.bookingCard}>
        <Text style={styles.sectionTitle}>Delivery location</Text>
        <Text style={styles.fieldLabel}>Full address</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter delivery address"
        />

        <Text style={[styles.fieldLabel, styles.mt16]}>Nearby area</Text>
        <View style={styles.optionRow}>
          {['Green Park', 'Whitefield', 'Koramangala', 'Indiranagar'].map((area) => (
            <Pressable
              key={area}
              style={[styles.optionButton, location.includes(area) && styles.optionButtonActive]}
              onPress={() => setLocation(`12, ${area} Colony, Bengaluru`)}
            >
              <Text style={[styles.optionText, location.includes(area) && styles.optionTextActive]}>{area}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {renderSummary()}

      <Pressable style={styles.primaryButton} onPress={goToNextStep}>
        <Text style={styles.primaryButtonText}>Find nearby vendors</Text>
      </Pressable>
    </View>
  );

  const renderVendorStep = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sequential vendor assignment</Text>
        <Text style={styles.sectionLink}>{activeOffer?.vendorsCount || 0} eligible</Text>
      </View>
      <Text style={styles.addressHint}>
        After payment, vendors are contacted in nearest-first order. Only one vendor receives the request at a time.
      </Text>

      {renderSummary()}

      {bookingError ? <Text style={styles.tankOffersError}>{bookingError}</Text> : null}
      <Pressable
        style={[styles.primaryButton, isSubmittingRequest && styles.proceedButtonDisabled]}
        disabled={isSubmittingRequest}
        onPress={() => setStep('payment')}
      >
        <Text style={styles.primaryButtonText}>Continue to payment</Text>
      </Pressable>
    </View>
  );

  const renderRequestSentStep = () => (
    <View>
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>{latestBookingStatus?.status === 'approved' ? 'Booking approved' : latestBookingStatus?.status === 'rejected' ? 'Booking update' : 'Request sent to vendor'}</Text>
        <Text style={styles.statusText}>
          {latestBookingStatus?.status === 'approved'
            ? `Your ${latestBookingStatus.tank} order has been approved by the vendor. Delivery is expected in ${latestBookingStatus.eta.toLowerCase()}.`
            : latestBookingStatus?.status === 'rejected'
              ? `Your ${latestBookingStatus.tank} request was rejected. Please choose another slot or vendor.`
              : `Your request for ${selectedTank.name} has been sent to ${latestBookingStatus?.vendor || 'the selected vendor'} for confirmation.`}
        </Text>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, latestBookingStatus?.status === 'approved' && styles.progressBarApproved, latestBookingStatus?.status === 'rejected' && styles.progressBarRejected]} />
        </View>
        <Text style={styles.statusMeta}>
          {latestBookingStatus?.status === 'approved'
            ? `Delivery window: ${latestBookingStatus.deliveryWindow || 'Today, 5:00 PM - 5:45 PM'}`
            : latestBookingStatus?.status === 'rejected'
              ? `Reason: ${latestBookingStatus.reason || 'Capacity unavailable'}`
              : 'Nearby vendors are contacted one at a time. Each vendor has 30 minutes to respond.'}
        </Text>
      </View>

      {latestBookingStatus?.status && latestBookingStatus.status !== 'pending' && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Vendor response</Text>
            <Text style={styles.summaryValue}>{latestBookingStatus.title}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expected ETA</Text>
            <Text style={styles.summaryValue}>{latestBookingStatus.eta}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery slot</Text>
            <Text style={styles.summaryValue}>{latestBookingStatus.deliveryWindow || latestBookingStatus.time}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment</Text>
            <Text style={[styles.summaryValue, styles.summaryAmount]}>{latestBookingStatus.payment}</Text>
          </View>
        </View>
      )}

      {renderSummary()}

      <Pressable style={styles.primaryButton} onPress={() => setActiveScreen('home')}>
        <Text style={styles.primaryButtonText}>Back to home</Text>
      </Pressable>
    </View>
  );

  const renderRejectedStep = () => (
    <View>
      <View style={styles.alertCard}>
        <Text style={styles.alertTitle}>Vendor rejected the request</Text>
        <Text style={styles.alertText}>Please try another nearby vendor or re-book with a new slot.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Remaining vendors</Text>
      </View>

      {remainingVendors.length > 0 ? (
        remainingVendors.map((vendor) => (
          <Pressable
            key={vendor.id}
            style={[styles.vendorCard, selectedVendorId === vendor.id && styles.vendorCardSelected]}
            onPress={() => setSelectedVendorId(vendor.id)}
          >
            <View style={styles.vendorRow}>
              <View>
                <Text style={styles.vendorName}>{vendor.name}</Text>
                <Text style={styles.vendorMeta}>⭐ {vendor.rating} • {vendor.eta}</Text>
              </View>
              <Text style={styles.vendorPrice}>{vendor.price}</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No other vendors are available. Please try another time.</Text>
        </View>
      )}

      <Pressable style={styles.primaryButton} onPress={() => setStep('vendors')}>
        <Text style={styles.primaryButtonText}>Book again</Text>
      </Pressable>
    </View>
  );

  const renderPaymentStep = () => (
    <View>
      <View style={styles.paymentCard}>
        <Text style={styles.statusTitle}>Order amount</Text>
        <Text style={styles.processingAmount}>{formattedPrice}</Text>
        <Text style={styles.paymentText}>Complete your order payment securely with Razorpay.</Text>
      </View>

      {renderSummary()}

      <Pressable style={styles.primaryButton} onPress={handleStartCheckout} disabled={isProcessingPayment}>
        {isProcessingPayment
          ? <ActivityIndicator color="#ffffff" />
          : <Text style={styles.primaryButtonText}>Continue to Razorpay</Text>}
      </Pressable>
    </View>
  );

  const renderSuccessStep = () => {
    const orderCapacity = paidOrder?.capacityLiters || chosenOffer?.capacityLiters || selectedTank?.capacityLiters || 1000;
    const orderWaterSource = (paidOrder?.waterSource || chosenOffer?.waterSource || selectedTank?.waterSource || 'bore');
    const orderWaterLabel = orderWaterSource.charAt(0).toUpperCase() + orderWaterSource.slice(1) + ' Water';
    const orderVendor = paidOrder?.vendorName || chosenOffer?.vendorName || selectedTank?.vendorName || 'Assigning verified vendor...';
    const orderAmount = Number(paidOrder?.amount ?? price).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const orderAddress = paidOrder?.deliveryAddress || deliveryLocation?.address || [doorNo, landmark, location].filter(Boolean).join(', ') || location || 'Delivery address confirmed';
    const orderSlot = `${selectedDay || 'Today'} · ${selectedTime || 'Standard Slot'}`;
    const orderIdDisplay = paidOrder?.id ? `#${String(paidOrder.id).slice(-6).toUpperCase()}` : '';
    const isApproved = paidOrder?.status === 'approved' || paidOrder?.status === 'confirmed';
    const isWaiting = !paidOrder?.status || paidOrder?.status === 'waiting_for_vendor';

    // Build shareable order object
    const shareableOrder = {
      ...paidOrder,
      customer: paidOrder?.customer || currentUser?.name || 'Customer',
      customerPhone: paidOrder?.customerPhone || currentUser?.phone || '',
      location: orderAddress,
      deliveryAddress: orderAddress,
      capacityLiters: orderCapacity,
      waterSource: orderWaterSource,
      amount: paidOrder?.amount ?? price,
      paymentStatus: 'paid',
      status: paidOrder?.status || 'confirmed',
      date: selectedDay || 'Today',
      time: selectedTime || 'Standard Delivery',
    };

    return (
      <View style={styles.successScreenContainer}>
        {/* Top Floating Mini Header */}
        <View style={styles.successTopNav}>
          <Pressable
            style={styles.successBackBtn}
            onPress={() => setActiveScreen('home')}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </Pressable>
          <View style={styles.successNavCenter}>
            <Text style={styles.successNavEyebrow}>ORDER CONFIRMATION</Text>
            <Text style={styles.successNavTitle}>Booking Receipt</Text>
          </View>
          <Pressable
            style={styles.successShareNavBtn}
            onPress={() => setIsShareModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Share Order"
          >
            <Ionicons name="share-social-outline" size={20} color="#0751A8" />
          </Pressable>
        </View>

        {/* Celebration / Status Hero */}
        <View style={styles.successHeroCard}>
          <View style={styles.successIconRingOuter}>
            <View style={styles.successIconRingInner}>
              <Ionicons name="checkmark-done" size={32} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.successMainTitle}>
            {isApproved ? 'Booking Confirmed!' : 'Order Placed Successfully!'}
          </Text>

          <Text style={styles.successSubtext}>
            {isApproved
              ? `Your water delivery has been accepted by ${orderVendor}.`
              : paidOrder?.status === 'no_vendor_available'
                ? `No nearby vendor accepted. Refund status: ${paidOrder.paymentStatus || 'processing'}.`
                : paidOrder?.status === 'cancelled'
                  ? `Your booking was cancelled. Refund status: ${paidOrder.paymentStatus || 'processing'}.`
                  : 'Payment verified securely. We are dispatching your request to the nearest verified water supplier.'}
          </Text>

          <View style={styles.paymentSuccessPill}>
            <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
            <Text style={styles.paymentSuccessPillText}>₹{orderAmount} · Paid via Razorpay</Text>
          </View>
        </View>

        {/* Order Ticket Card */}
        <View style={styles.orderTicketCard}>
          {/* Ticket Header */}
          <View style={styles.ticketHeaderRow}>
            <View>
              <Text style={styles.ticketLabel}>ORDER ID</Text>
              <Text style={styles.ticketIdValue}>{orderIdDisplay || '#BHAGIRA-ORDER'}</Text>
            </View>
            <View style={[
              styles.ticketStatusBadge,
              isApproved ? styles.ticketStatusBadgeApproved : styles.ticketStatusBadgeWaiting
            ]}>
              <View style={[
                styles.ticketStatusDot,
                isApproved ? styles.ticketStatusDotApproved : styles.ticketStatusDotWaiting
              ]} />
              <Text style={[
                styles.ticketStatusText,
                isApproved ? styles.ticketStatusTextApproved : styles.ticketStatusTextWaiting
              ]}>
                {isApproved ? 'Confirmed' : 'Assigning Vendor'}
              </Text>
            </View>
          </View>

          {/* Tanker Visual Banner */}
          <View style={styles.ticketTankerRow}>
            <View style={styles.ticketTankerImgWrap}>
              <Image
                source={getTankerImage(orderCapacity)}
                style={styles.ticketTankerImg}
                resizeMode="contain"
              />
              {!tankerTruckImages[orderCapacity] ? (
                <View style={[styles.tankTextOverlay, { left: '55%', top: '24%' }]}>
                  <Text style={[styles.tankLitresText, { fontSize: 8 }]}>
                    {orderCapacity >= 1000 ? `${(orderCapacity / 1000).toLocaleString('en-IN')}k L` : `${orderCapacity} L`}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.ticketTankerDetails}>
              <Text style={styles.ticketTankerCapacity}>
                {Number(orderCapacity).toLocaleString('en-IN')} L Tanker
              </Text>
              <View style={styles.ticketWaterTypeBadge}>
                <Ionicons name="water" size={13} color="#0284C7" />
                <Text style={styles.ticketWaterTypeText}>{orderWaterLabel}</Text>
              </View>
              <Text style={styles.ticketAmountText}>Total Paid: ₹{orderAmount}</Text>
            </View>
          </View>

          <View style={styles.ticketDivider} />

          {/* Key Delivery Details Grid */}
          <View style={styles.ticketDetailRows}>
            <View style={styles.ticketDetailRow}>
              <View style={styles.ticketIconWrap}>
                <Ionicons name="location" size={18} color="#0751A8" />
              </View>
              <View style={styles.ticketDetailContent}>
                <Text style={styles.ticketDetailLabel}>Delivery Address</Text>
                <Text style={styles.ticketDetailValue} numberOfLines={2}>
                  {orderAddress}
                </Text>
              </View>
            </View>

            <View style={styles.ticketDetailRow}>
              <View style={styles.ticketIconWrap}>
                <Ionicons name="time" size={18} color="#0751A8" />
              </View>
              <View style={styles.ticketDetailContent}>
                <Text style={styles.ticketDetailLabel}>Scheduled Slot</Text>
                <Text style={styles.ticketDetailValue}>{orderSlot}</Text>
              </View>
            </View>

            <View style={styles.ticketDetailRow}>
              <View style={styles.ticketIconWrap}>
                <Ionicons name="business" size={18} color="#0751A8" />
              </View>
              <View style={styles.ticketDetailContent}>
                <Text style={styles.ticketDetailLabel}>Water Supplier</Text>
                <Text style={styles.ticketDetailValue}>{orderVendor}</Text>
              </View>
            </View>
          </View>

          {/* Mini Live Delivery Steps */}
          <View style={styles.orderStepsContainer}>
            <Text style={styles.orderStepsHeader}>Delivery Progress</Text>
            <View style={styles.orderStepsRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotDone]}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
                <Text style={styles.stepLabelActive}>Paid</Text>
              </View>
              <View style={[styles.stepLine, isApproved && styles.stepLineDone]} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, isApproved ? styles.stepDotDone : styles.stepDotActive]}>
                  {isApproved ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <ActivityIndicator size={10} color="#FFFFFF" />
                  )}
                </View>
                <Text style={isApproved ? styles.stepLabelActive : styles.stepLabelPending}>Accepted</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotInactive]}>
                  <Text style={styles.stepNum}>3</Text>
                </View>
                <Text style={styles.stepLabelInactive}>Dispatched</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotInactive]}>
                  <Text style={styles.stepNum}>4</Text>
                </View>
                <Text style={styles.stepLabelInactive}>Delivered</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.successActionsContainer}>
          <Pressable
            style={styles.successPrimaryBtn}
            onPress={() => setActiveScreen('my-bookings')}
            accessibilityRole="button"
            accessibilityLabel="Track Order in My Bookings"
          >
            <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
            <Text style={styles.successPrimaryBtnText}>Track in My Bookings</Text>
          </Pressable>

          <View style={styles.successSecondaryRow}>
            <Pressable
              style={styles.successShareBtn}
              onPress={() => setIsShareModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Share Order Details"
            >
              <Ionicons name="share-social-outline" size={19} color="#0751A8" />
              <Text style={styles.successShareBtnText}>Share Order</Text>
            </Pressable>

            <Pressable
              style={styles.successHomeBtn}
              onPress={() => setActiveScreen('home')}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Ionicons name="home-outline" size={19} color="#0F172A" />
              <Text style={styles.successHomeBtnText}>Back to Home</Text>
            </Pressable>
          </View>

          {isWaiting ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.successCancelBtn, isCancellingOrder && styles.proceedButtonDisabled]}
              disabled={isCancellingOrder}
              onPress={async () => {
                setIsCancellingOrder(true);
                setSummaryError('');
                try {
                  const cancelledOrder = await vendorApi.cancelCustomerOrder(paidOrder.id);
                  const updated = { ...paidOrder, ...cancelledOrder, status: 'cancelled' };
                  setPaidOrder(updated);
                  previousStatusRef.current = 'cancelled';
                  onPaymentComplete?.(updated);
                } catch (error) {
                  setSummaryError(error.message || 'Unable to cancel this booking.');
                } finally {
                  setIsCancellingOrder(false);
                }
              }}
            >
              {isCancellingOrder ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Text style={styles.successCancelBtnText}>Cancel Booking</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Share Modal */}
        <ShareOrderModal
          visible={isShareModalOpen}
          order={shareableOrder}
          onClose={() => setIsShareModalOpen(false)}
          onToast={(msg, type) => showToast?.(msg, type)}
        />
      </View>
    );
  };

  return (
    <View style={styles.screenShell}>
      {summaryError ? (
        <Toast
          message={summaryError}
          type="error"
          onDismiss={() => setSummaryError('')}
        />
      ) : null}
      {bookingError ? (
        <Toast
          message={bookingError}
          type="error"
          onDismiss={() => setBookingError('')}
        />
      ) : null}
      {tankOffersError ? (
        <Toast
          message={tankOffersError}
          type="error"
          onDismiss={() => setTankOffersError('')}
        />
      ) : null}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={step === 'summary' ? styles.summaryPageBody : styles.pageBody}
      >
        {step === 'summary' ? (
          renderBookingSummary()
        ) : step === 'success' ? (
          renderSuccessStep()
        ) : (
          <>
            <ScreenHeader
              label="Book your tank"
              title="Booking"
              onMenuPress={onOpenMenu}
              onAvatarPress={onOpenMenu}
              isLoggedIn={isLoggedIn}
              onBackPress={onBackPress}
            />
            {step === 'tank' && renderTankStep()}
          </>
        )}
        {step === 'location' && renderLocationStep()}
        {step === 'vendors' && renderVendorStep()}
        {step === 'request-sent' && renderRequestSentStep()}
        {step === 'rejected' && renderRejectedStep()}
        {step === 'payment' && renderPaymentStep()}
      </ScrollView>
      {step === 'summary' ? renderSummaryFooter() : null}

      {/* Location / Address Update Modal Pop-Up */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowAddressModal(false)} />

          {/* White Bottom Sheet */}
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderTitleWrap}>
                <Ionicons name="location" size={20} color="#0751A8" style={{ marginRight: 8 }} />
                <Text style={styles.sheetTitle}>Select your Location</Text>
              </View>
              <Pressable
                style={styles.sheetCloseButton}
                onPress={() => setShowAddressModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
              >
                <Ionicons name="close" size={20} color="#0F172A" />
              </Pressable>
            </View>

            {/* Search Input Box */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.modalSearchInput}
                value={addressDraft}
                onChangeText={setAddressDraft}
                placeholder="search delivery location"
                placeholderTextColor="#94a3b8"
                autoFocus={true}
              />
              {isSearchingAddress ? (
                <ActivityIndicator size="small" color="#0284c7" />
              ) : addressDraft ? (
                <Pressable
                  onPress={() => {
                    setAddressDraft('');
                    setAddressSuggestions([]);
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>

            {/* Use Current Location Button */}
            <Pressable
              style={styles.useCurrentLocationCard}
              onPress={handleUseCurrentLocation}
              disabled={isLocating}
            >
              <Ionicons name="locate" size={20} color="#16a34a" style={{ marginRight: 10 }} />
              <Text style={styles.useCurrentLocationText}>Use current location</Text>
              {isLocating ? (
                <ActivityIndicator size="small" color="#16a34a" style={{ marginLeft: 'auto' }} />
              ) : null}
            </Pressable>

            {/* Search Results / Suggestions */}
            {addressSuggestions.length > 0 ? (
              <ScrollView style={styles.modalResultsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalSectionLabel}>Suggestions</Text>
                {addressSuggestions.map((result) => {
                  const mainTitle = result.address?.neighbourhood || result.address?.suburb || result.address?.road || result.display_name.split(',')[0];
                  const subTitle = formatAddress(result.address) || result.display_name;
                  return (
                    <Pressable
                      key={result.place_id}
                      style={styles.modalSearchResultItem}
                      onPress={() => handleSelectSuggestion(result)}
                    >
                      <Ionicons name="location-outline" size={18} color="#64748b" style={{ marginRight: 12, marginTop: 2 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.modalResultMain} numberOfLines={1}>
                          {mainTitle}
                        </Text>
                        <Text style={styles.modalResultSub} numberOfLines={2}>
                          {subTitle}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Set This Address button if user typed without picking suggestion */}
            {addressDraft.trim() && addressDraft.trim() !== location ? (
              <Pressable
                style={styles.confirmLocationButton}
                onPress={handleConfirmCustomAddress}
              >
                <Text style={styles.confirmLocationButtonText}>Set This Address</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
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
  },
  pageBody: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 110,
    alignSelf: 'center',
  },
  summaryPageBody: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'android' ? 240 : 190,
    alignSelf: 'center',
  },
  summaryHeader: {
    minHeight: 64,
    marginHorizontal: -12,
    paddingHorizontal: 16,
    backgroundColor: '#0751A8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  summaryBackButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderTitle: {
    ...TYPOGRAPHY.sectionTitle,
    color: '#ffffff',
  },
  summaryHeaderSpacer: {
    width: 38,
  },
  productCard: {
    minHeight: 110,
    marginTop: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tankerImgWrap: {
    width: 120,
    height: 70,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tankerImg: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 17,
    color: '#0f172a',
    marginBottom: 4,
  },
  productDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  productCapacity: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 13,
    color: '#64748b',
  },
  productPrice: {
    ...TYPOGRAPHY.priceSmall,
    fontSize: 15,
    color: '#0751A8',
  },
  bookingSection: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E8EFF7',
    shadowColor: '#0751A8',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    ...TYPOGRAPHY.cardTitle,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FBFE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    padding: 10,
    marginBottom: 12,
  },
  currentAddressText: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 17,
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EBF5FF',
    marginLeft: 6,
  },
  editAddressText: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 12,
    color: '#0751A8',
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
  modalSheet: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    minHeight: 380,
    maxHeight: '85%',
    shadowColor: '#0751A8',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
    zIndex: 100000,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetTitle: {
    ...TYPOGRAPHY.sectionTitle,
    fontSize: 18,
    color: '#0F172A',
    fontFamily: fontFamilies.bold,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    ...TYPOGRAPHY.inputValue,
    color: '#0f172a',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  useCurrentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  useCurrentLocationText: {
    ...TYPOGRAPHY.buttonSmall,
    color: '#16a34a',
  },
  modalResultsScroll: {
    maxHeight: 280,
    marginTop: 6,
  },
  modalSectionLabel: {
    ...TYPOGRAPHY.navLabel,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  modalSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalResultMain: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 14,
    color: '#0f172a',
  },
  modalResultSub: {
    ...TYPOGRAPHY.secondary,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  confirmLocationButton: {
    backgroundColor: '#0751A8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmLocationButtonText: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputGroupLabel: {
    ...TYPOGRAPHY.inputLabel,
    color: '#475569',
    marginBottom: 5,
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#E8EFF7',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 12,
  },
  inputFieldIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    ...TYPOGRAPHY.inputValue,
    fontSize: 13,
    color: '#0f172a',
  },
  dayOptionsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  dayChip: {
    minWidth: 76,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E8EFF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: '#0751A8',
    borderColor: '#0751A8',
  },
  dayChipTitle: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 12,
    color: '#64748b',
  },
  dayChipTitleActive: {
    color: '#ffffff',
  },
  dayChipSubtitle: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  dayChipSubtitleActive: {
    color: '#bae6fd',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 12,
  },
  timeSlotCard: {
    width: '48.5%',
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E8EFF7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  timeSlotCardActive: {
    backgroundColor: '#EBF5FF',
    borderColor: '#0751A8',
  },
  timeSlotText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  timeSlotTextActive: {
    color: '#0751A8',
    fontWeight: '800',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  termsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsCheckboxChecked: {
    backgroundColor: '#0751A8',
    borderColor: '#0751A8',
  },
  termsText: {
    color: '#64748b',
    fontSize: 12,
  },
  termsLink: {
    color: '#0751A8',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  promoSection: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  promoButton: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoButtonText: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  promoEntry: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  promoInput: {
    flex: 1,
    minWidth: 140,
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  promoApplyButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  promoMessage: {
    width: '100%',
    color: '#64748b',
    fontSize: 12,
  },
  orderCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  orderLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: '#111827',
  },
  orderValue: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 14,
    color: '#111827',
  },
  orderTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d8e0e7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalLabel: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 15,
    color: '#111827',
  },
  orderTotalValue: {
    ...TYPOGRAPHY.price,
    fontSize: 20,
    color: '#0751A8',
  },
  paymentCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  paymentMethod: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentMethodText: {
    flex: 1,
    ...TYPOGRAPHY.cardTitle,
    fontSize: 14,
    color: '#0f172a',
  },
  paymentRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0751A8',
  },
  noteCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  noteTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  noteText: {
    color: '#64748b',
    fontSize: 12.5,
    lineHeight: 19,
  },
  footerSpacer: {
    height: 4,
  },
  summaryFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'android' ? 44 : 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0751A8',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  tankTextOverlay: {
    position: 'absolute',
    left: '68%',
    top: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tankLitresText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0751A8',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerTotal: {
    flex: 1,
  },
  footerTotalPrice: {
    color: '#0f172a',
    ...TYPOGRAPHY.price,
    fontSize: 21,
  },
  footerTotalLabel: {
    ...TYPOGRAPHY.captionSmall,
    color: '#64748b',
    marginTop: 1,
  },
  proceedButton: {
    height: 52,
    minWidth: 180,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0751A8',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  proceedButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
  },
  proceedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proceedButtonText: {
    ...TYPOGRAPHY.button,
    color: '#ffffff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    ...TYPOGRAPHY.sectionTitle,
    color: '#0f172a',
  },
  offerRadiusCaption: {
    ...TYPOGRAPHY.caption,
    color: '#64748b',
    marginTop: 4,
  },
  sectionLink: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 12,
    color: '#0284c7',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tankOffersState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  tankOffersStateText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  tankOffersError: {
    color: '#b91c1c',
    fontSize: 13,
    padding: 12,
  },
  summaryError: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 8,
  },
  tankOfferCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dfeaf4',
  },
  tankOfferCardSelected: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
  },
  tankOfferDetails: {
    flex: 1,
  },
  tankCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dfeaf4',
  },
  tankCardSelected: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  tankName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  tankVolume: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  tankPrice: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
  },
  tankBadge: {
    marginTop: 10,
    fontSize: 11,
    color: '#475569',
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
  input: {
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dbeaf5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  mt16: {
    marginTop: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionButtonActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  optionTextActive: {
    color: '#0369a1',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
    maxWidth: '60%',
  },
  summaryAmount: {
    color: '#0284c7',
    fontSize: 18,
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0284c7',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  vendorCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dfeaf4',
  },
  vendorCardSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#e0f2fe',
  },
  vendorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  vendorMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  vendorPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0284c7',
  },
  vendorTag: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  progressWrap: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 18,
    marginBottom: 12,
  },
  progressBar: {
    width: '70%',
    height: '100%',
    backgroundColor: '#22c55e',
  },
  progressBarApproved: {
    width: '100%',
    height: '100%',
    backgroundColor: '#16a34a',
  },
  progressBarRejected: {
    width: '40%',
    height: '100%',
    backgroundColor: '#ef4444',
  },
  statusMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#166534',
    fontWeight: '700',
  },
  secondaryButtonAlt: {
    flex: 1,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  secondaryButtonAltText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  alertCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9a4d00',
    marginBottom: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#7c2d12',
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  processingAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0284c7',
    marginVertical: 10,
  },
  paymentText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  successCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  successIcon: {
    fontSize: 42,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#166534',
    lineHeight: 20,
  },

  /* ── Redesigned Order Success Screen ── */
  successScreenContainer: {
    paddingBottom: 40,
  },
  successTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
  },
  successBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  successNavCenter: {
    alignItems: 'center',
  },
  successNavEyebrow: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    letterSpacing: 0.8,
    color: '#0751A8',
    textTransform: 'uppercase',
  },
  successNavTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    color: '#0F172A',
    marginTop: 1,
  },
  successShareNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E2EE',
  },
  successHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  successIconRingOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconRingInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successMainTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  paymentSuccessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
  },
  paymentSuccessPillText: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    color: '#15803D',
  },

  /* Ticket Card */
  orderTicketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0751A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    letterSpacing: 0.6,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  ticketIdValue: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    color: '#0F172A',
    marginTop: 2,
  },
  ticketStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
  },
  ticketStatusBadgeApproved: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  ticketStatusBadgeWaiting: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ticketStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  ticketStatusDotApproved: {
    backgroundColor: '#16A34A',
  },
  ticketStatusDotWaiting: {
    backgroundColor: '#D97706',
  },
  ticketStatusText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
  },
  ticketStatusTextApproved: {
    color: '#15803D',
  },
  ticketStatusTextWaiting: {
    color: '#B45309',
  },

  /* Tanker Banner */
  ticketTankerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 16,
  },
  ticketTankerImgWrap: {
    width: 68,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  ticketTankerImg: {
    width: 60,
    height: 44,
  },
  ticketTankerDetails: {
    flex: 1,
  },
  ticketTankerCapacity: {
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  ticketWaterTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  ticketWaterTypeText: {
    fontSize: 11,
    fontFamily: fontFamilies.medium,
    color: '#0284C7',
  },
  ticketAmountText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: '#475569',
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },

  /* Key Details */
  ticketDetailRows: {
    gap: 14,
    marginBottom: 18,
  },
  ticketDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ticketIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EDF3F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  ticketDetailContent: {
    flex: 1,
  },
  ticketDetailLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.medium,
    color: '#64748B',
    marginBottom: 2,
  },
  ticketDetailValue: {
    fontSize: 13.5,
    fontFamily: fontFamilies.semiBold,
    color: '#0F172A',
    lineHeight: 18,
  },

  /* Steps */
  orderStepsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  orderStepsHeader: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    letterSpacing: 0.6,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  orderStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  stepDotDone: {
    backgroundColor: '#16A34A',
  },
  stepDotActive: {
    backgroundColor: '#0751A8',
  },
  stepDotInactive: {
    backgroundColor: '#E2E8F0',
  },
  stepNum: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: '#64748B',
  },
  stepLabelActive: {
    fontSize: 10.5,
    fontFamily: fontFamilies.bold,
    color: '#15803D',
  },
  stepLabelPending: {
    fontSize: 10.5,
    fontFamily: fontFamilies.bold,
    color: '#0751A8',
  },
  stepLabelInactive: {
    fontSize: 10.5,
    fontFamily: fontFamilies.medium,
    color: '#94A3B8',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 3,
    marginBottom: 16,
  },
  stepLineDone: {
    backgroundColor: '#16A34A',
  },

  /* Actions */
  successActionsContainer: {
    gap: 12,
  },
  successPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0751A8',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#0751A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  successPrimaryBtnText: {
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },
  successSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  successShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDF3F9',
    borderWidth: 1.5,
    borderColor: '#D8E2EE',
    paddingVertical: 14,
    borderRadius: 14,
  },
  successShareBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: '#0751A8',
  },
  successHomeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 14,
  },
  successHomeBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: '#0F172A',
  },
  successCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successCancelBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    color: '#EF4444',
  },
});
