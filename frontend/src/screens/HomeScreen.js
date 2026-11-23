import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Toast from '../components/Toast';
import PullToRefreshScrollView from '../components/PullToRefreshScrollView';
import NotificationCenterModal from '../components/NotificationCenterModal';
import { getStoredNotifications, triggerHaptic } from '../utils/mobileNotifications';
import { vendorApi } from '../authApi';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

const ANDROID_STATUS_BAR = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 36) : 0;

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

function hasTankerImage(capacity) {
  return Boolean(tankerTruckImages[Number(capacity)]);
}

function getTankerImage(capacity) {
  const num = Number(capacity);
  if (tankerTruckImages[num]) return tankerTruckImages[num];
  return require('../../assets/trucks/truck_base.png');
}

function getRatingForCapacity(capacity) {
  const ratings = {
    100: '4.9',
    500: '4.8',
    1000: '4.8',
    2000: '4.9',
    5000: '4.9',
    6000: '3.9',
    7000: '5.0',
    10000: '4.8',
    12000: '4.7',
  };
  return ratings[Number(capacity)] || '4.8';
}

function getSortedOffers(offers) {
  return [...offers].sort((a, b) => Number(a.capacityLiters) - Number(b.capacityLiters));
}

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

function getPrimaryArea(addressString) {
  if (!addressString) return '';
  const parts = addressString.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}, ${parts[1]}`;
}

function splitLocationDisplay(addressString, isLoading) {
  if (isLoading) {
    return {
      title: 'Locating...',
      subtitle: 'Fetching your delivery address',
    };
  }
  if (!addressString) {
    return {
      title: 'Select Location',
      subtitle: 'Tap to choose delivery location',
    };
  }
  if (addressString.startsWith('Location (')) {
    return { title: addressString, subtitle: 'Tap to change location' };
  }
  const parts = addressString.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { title: 'Select Location', subtitle: 'Tap to set address' };
  }
  if (parts.length === 1) {
    return { title: parts[0], subtitle: 'Tap to change location' };
  }
  return { title: parts[0], subtitle: parts.slice(1).join(', ') };
}

async function resolveAddressFromCoords(latitude, longitude) {
  // 1. Try native expo-location reverse geocoding first (uses Android Google Play Services)
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
      if (built && built.length > 3) {
        return built;
      }
    }
  } catch (err) {
    console.warn('Native reverseGeocode error:', err);
  }

  // 2. Fallback to OpenStreetMap Nominatim with required User-Agent
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
      const result = await response.json();
      const formatted = formatAddress(result.address) || result.display_name;
      if (formatted) return formatted;
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode error:', err);
  }

  // 3. Fallback to formatted coordinates so address is NEVER empty
  return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
}

export default function HomeScreen({
  setActiveScreen,
  selectedTank,
  setSelectedTank,
  isLoggedIn,
  currentUser,
  onOpenMenu,
  onBackPress,
  deliveryLocation,
  setDeliveryLocation,
  onSelectOffer,
  autoScrollToOffers,
  onResetAutoScroll,
  onModalOpenChange,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = Math.min(windowWidth, 440);
  const isSmallScreen = screenWidth < 365;
  const isLargeScreen = screenWidth >= 410;

  const [addressQuery, setAddressQuery] = useState(deliveryLocation?.source === 'address' ? deliveryLocation.address : '');
  const [addressResults, setAddressResults] = useState([]);
  const [addressSearchError, setAddressSearchError] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(!deliveryLocation?.address);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const locationSelectionVersion = useRef(0);
  const addressSearchVersion = useRef(0);
  const selectedAddressQuery = useRef('');
  const scrollViewRef = useRef(null);
  const offersSectionY = useRef(0);
  const [nearbyOffers, setNearbyOffers] = useState([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    onModalOpenChange?.(showLocationModal || showNotifications);
  }, [showLocationModal, showNotifications]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => {
    try {
      const list = getStoredNotifications();
      return list.filter((n) => !n.read).length;
    } catch {
      return 2;
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    triggerHaptic('medium');
    try {
      if (deliveryLocation?.latitude && deliveryLocation?.longitude) {
        const offers = await vendorApi.nearbyOffers({
          latitude: deliveryLocation.latitude,
          longitude: deliveryLocation.longitude,
        });
        setNearbyOffers(offers);
      }
      await new Promise((r) => setTimeout(r, 600));
    } catch {
    } finally {
      setIsRefreshing(false);
      triggerHaptic('light');
    }
  };
  const locationDisplay = splitLocationDisplay(deliveryLocation?.address, isLoadingLocation);

  useEffect(() => {
    let isMounted = true;
    const selectionVersion = locationSelectionVersion.current;

    const getCurrentLocation = async () => {
      if (locationAttempt === 0 && deliveryLocation?.address && Number.isFinite(deliveryLocation.latitude)) {
        setIsLoadingLocation(false);
        return;
      }

      setIsLoadingLocation(true);
      setLocationError('');

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          throw new Error(
            Platform.OS === 'web'
              ? 'Location is blocked for this site. Open site permissions beside your address bar, set Location to Allow, then retry.'
              : 'Location permission is required to detect nearby water tankers. Please enable location permission for BHAGIRA in your device settings.'
          );
        }

        try {
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            await Location.enableNetworkProviderAsync();
          }
        } catch {}

        // 1. Check last known cached position first for instantaneous response
        let coords = null;
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({});
          if (lastKnown?.coords && Number.isFinite(lastKnown.coords.latitude)) {
            coords = lastKnown.coords;
          }
        } catch {}

        // 2. If no cached position, get current position with Balanced accuracy (fast & reliable)
        if (!coords) {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = currentLocation.coords;
        }

        if (!isMounted || locationSelectionVersion.current !== selectionVersion) return;

        const coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        };

        // Immediately resolve human-readable address using native Geocoder
        setIsLoadingAddress(true);
        const resolvedAddress = await resolveAddressFromCoords(coords.latitude, coords.longitude);

        if (!isMounted || locationSelectionVersion.current !== selectionVersion) return;

        setDeliveryLocation({
          ...coordinates,
          address: resolvedAddress,
          source: 'gps',
        });
        setAddressError(false);

        // In the background, optionally refine with High accuracy if possible
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).then(async (fresh) => {
          if (!isMounted || locationSelectionVersion.current !== selectionVersion) return;
          if (fresh?.coords && Number.isFinite(fresh.coords.latitude)) {
            const refinedAddress = await resolveAddressFromCoords(fresh.coords.latitude, fresh.coords.longitude);
            if (isMounted && locationSelectionVersion.current === selectionVersion) {
              setDeliveryLocation({
                latitude: fresh.coords.latitude,
                longitude: fresh.coords.longitude,
                accuracy: fresh.coords.accuracy,
                address: refinedAddress,
                source: 'gps',
              });
            }
          }
        }).catch(() => {});

      } catch (error) {
        if (isMounted) {
          const message = error.message || 'Unable to get your location. Please try again.';
          setLocationError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingLocation(false);
          setIsLoadingAddress(false);
        }
      }
    };

    getCurrentLocation();
    return () => { isMounted = false; };
  }, [locationAttempt]);

  useEffect(() => {
    if (!deliveryLocation) return;
    if (deliveryLocation.source === 'address') setAddressQuery(deliveryLocation.address || '');
  }, [deliveryLocation]);

  useEffect(() => {
    let isMounted = true;
    if (!deliveryLocation || !Number.isFinite(deliveryLocation.latitude) || !Number.isFinite(deliveryLocation.longitude)) {
      setNearbyOffers([]);
      setIsLoadingOffers(false);
      setOffersError('');
      return () => { isMounted = false; };
    }

    setIsLoadingOffers(true);
    setNearbyOffers([]);
    setOffersError('');
    vendorApi.nearbyOffers({
      latitude: deliveryLocation.latitude,
      longitude: deliveryLocation.longitude,
    }).then((offers) => {
      if (isMounted) setNearbyOffers(offers);
    }).catch((error) => {
      if (isMounted) setOffersError(error.message || 'Unable to load nearby tank offers.');
    }).finally(() => {
      if (isMounted) setIsLoadingOffers(false);
    });

    return () => { isMounted = false; };
  }, [deliveryLocation?.latitude, deliveryLocation?.longitude]);

  useEffect(() => {
    if (autoScrollToOffers && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: offersSectionY.current > 0 ? offersSectionY.current - 12 : 340,
          animated: true,
        });
        onResetAutoScroll?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoScrollToOffers, nearbyOffers.length]);

  const chooseOffer = (offer) => {
    const tank = {
      id: offer.capacityLiters,
      name: offer.name,
      liters: `${offer.capacityLiters} L`,
      price: `₹${Number(offer.displayedPrice).toLocaleString('en-IN')}`,
    };
    setSelectedTank(tank);
    onSelectOffer?.(offer);
    setActiveScreen('booking');
  };

  const handleNavigateToOffers = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: offersSectionY.current > 0 ? offersSectionY.current : 340,
        animated: true,
      });
    }
  };

  useEffect(() => {
    const query = addressQuery.trim();
    const searchVersion = ++addressSearchVersion.current;

    if (query === selectedAddressQuery.current) {
      setIsSearchingAddress(false);
      setAddressSearchError('');
      return undefined;
    }

    if (query.length < 3) {
      setAddressResults([]);
      setAddressSearchError(query ? 'Type at least 3 characters to see address suggestions.' : '');
      setIsSearchingAddress(false);
      return undefined;
    }

    setAddressResults([]);
    setAddressSearchError('');
    setIsSearchingAddress(true);
    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          addressdetails: '1',
          limit: '5',
          q: query,
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'BHAGIRA-WaterApp/1.0 (contact: support@bhagira.com)',
          },
        });
        if (!response.ok) throw new Error(`Address lookup failed with status ${response.status}.`);
        const results = await response.json();
        if (searchVersion !== addressSearchVersion.current) return;
        if (!Array.isArray(results) || results.length === 0) {
          setAddressSearchError('No matching address found. Try adding your area or city.');
          return;
        }
        setAddressResults(results);
      } catch (error) {
        if (searchVersion === addressSearchVersion.current) {
          setAddressSearchError(error.message || 'Unable to search this address. Please try again.');
        }
      } finally {
        if (searchVersion === addressSearchVersion.current) setIsSearchingAddress(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [addressQuery]);

  const selectAddress = (result) => {
    const address = formatAddress(result.address) || result.display_name;
    const coordinates = { latitude: Number(result.lat), longitude: Number(result.lon), accuracy: null };
    if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
      setAddressSearchError('The selected address did not include valid map coordinates. Choose another result.');
      return;
    }

    locationSelectionVersion.current += 1;
    addressSearchVersion.current += 1;
    selectedAddressQuery.current = address;
    setAddressQuery(address);
    setDeliveryLocation({ ...coordinates, address, source: 'address' });
    setAddressResults([]);
    setAddressSearchError('');
    setIsSearchingAddress(false);
    setLocationError('');
    setAddressError(false);
    setShowLocationModal(false);
  };

  return (
    <View style={styles.screenShell}>
      {offersError ? (
        <Toast
          message={offersError}
          type="error"
          onDismiss={() => setOffersError('')}
        />
      ) : null}
      {addressSearchError ? (
        <Toast
          message={addressSearchError}
          type="error"
          onDismiss={() => setAddressSearchError('')}
        />
      ) : null}
      <PullToRefreshScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshMessage="Refreshing water tankers & offers..."
      >
        {/* Unified Hero Header Banner with Background Image */}
        <View style={[styles.heroBannerWrap, isSmallScreen && { minHeight: 310 + ANDROID_STATUS_BAR }]}>
          <RNStatusBar translucent backgroundColor="transparent" barStyle="light-content" />
          <Image
            source={require('../../assets/hero_bg_user_cropped.jpg')}
            style={styles.heroAbsoluteBg}
            resizeMode="cover"
          />

          <View style={styles.heroContentOverlay}>
            {/* Top Bar: Inline Location on Left, Notification & Profile on Right */}
            <View style={styles.topLogoBar}>
              <Pressable
                style={styles.topLocationSelector}
                onPress={() => setShowLocationModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Select delivery location"
              >
                <View style={styles.topLocationTitleRow}>
                  <Ionicons name="location-sharp" size={isSmallScreen ? 15 : 16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={[styles.topLocationTitle, isSmallScreen && { fontSize: 15 }]} numberOfLines={1}>
                    {locationDisplay.title}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </View>
                <Text style={[styles.topLocationSubtitle, isSmallScreen && { fontSize: 10.8 }]} numberOfLines={1}>
                  {locationDisplay.subtitle}
                </Text>
              </Pressable>

              <View style={styles.topActionsGroup}>
                <Pressable
                  style={[styles.iconCircleButton, isSmallScreen && { width: 34, height: 34, borderRadius: 17 }]}
                  onPress={() => setShowNotifications(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={isSmallScreen ? 17 : 19} color="#FFFFFF" />
                  {unreadNotifCount > 0 && <View style={styles.notifDot} />}
                </Pressable>

                <Pressable
                  style={[styles.avatarButton, isSmallScreen && { width: 34, height: 34, borderRadius: 17 }]}
                  onPress={onOpenMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Open menu"
                >
                  <Text style={[styles.avatarText, isSmallScreen && { fontSize: 14 }]}>
                    {(currentUser?.name ? currentUser.name.trim().charAt(0).toUpperCase() : '')
                      || (currentUser?.businessName ? currentUser.businessName.trim().charAt(0).toUpperCase() : '')
                      || (isLoggedIn ? 'R' : 'G')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Hero Main Content Row: Left Text + Right Transparent Space for Background Truck */}
            <View style={[styles.heroMainRow, isSmallScreen && { minHeight: 110, marginBottom: 14 }]}>
              <View style={[styles.heroTextSide, isSmallScreen && { maxWidth: '58%' }]}>
                <Text style={[
                  styles.heroMainTitle,
                  isSmallScreen
                    ? { fontSize: 20.5, lineHeight: 24.5 }
                    : isLargeScreen
                      ? { fontSize: 24, lineHeight: 28 }
                      : null,
                ]}>
                  Book Water at{'\n'}
                  <Text style={styles.heroAccentTitle}>Your Doorstep</Text>
                </Text>
                <Text style={[
                  styles.heroSubtitle,
                  isSmallScreen && { fontSize: 10.5, lineHeight: 14.5, marginTop: 4 },
                ]}>
                  Connecting you with trusted water suppliers and easy tanker delivery services, all in one place
                </Text>
              </View>
              <View style={styles.heroTruckPlaceholder} />
            </View>

            {/* Feature Pills */}
            <View style={[styles.featurePillsRow, isSmallScreen && { gap: 6, marginBottom: 10 }]}>
              <View style={[styles.featurePill, isSmallScreen && { paddingHorizontal: 8, paddingVertical: 5, gap: 5 }]}>
                <View style={[styles.featurePillIconCircle, isSmallScreen && { width: 22, height: 22, borderRadius: 11 }]}>
                  <Ionicons name="shield-checkmark" size={isSmallScreen ? 11.5 : 13} color="#00C2E9" />
                </View>
                <View style={styles.featurePillTextWrap}>
                  <Text style={[styles.featurePillSub, isSmallScreen && { fontSize: 8 }]}>Verified</Text>
                  <Text style={[styles.featurePillMain, isSmallScreen && { fontSize: 10 }]}>Vendors</Text>
                </View>
              </View>

              <View style={[styles.featurePill, isSmallScreen && { paddingHorizontal: 8, paddingVertical: 5, gap: 5 }]}>
                <View style={[styles.featurePillIconCircle, isSmallScreen && { width: 22, height: 22, borderRadius: 11 }]}>
                  <Ionicons name="water" size={isSmallScreen ? 11.5 : 13} color="#00C2E9" />
                </View>
                <View style={styles.featurePillTextWrap}>
                  <Text style={[styles.featurePillSub, isSmallScreen && { fontSize: 8 }]}>Safe &</Text>
                  <Text style={[styles.featurePillMain, isSmallScreen && { fontSize: 10 }]}>Clean Water</Text>
                </View>
              </View>
            </View>

            {/* Big CTA Button */}
            <Pressable
              style={[styles.heroCtaButton, isSmallScreen && { height: 44 }]}
              onPress={handleNavigateToOffers}
            >
              <Text style={[styles.heroCtaText, isSmallScreen && { fontSize: 14 }]}>Book Water Tanker Now</Text>
              <Ionicons name="arrow-forward" size={isSmallScreen ? 16 : 18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.bodyContent}
          onLayout={(e) => {
            offersSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Nearby Tank Offers</Text>
              <Text style={styles.offerSubtitle}>
                {deliveryLocation ? 'Available tanks near your delivery location' : 'Set your location to find water vendors'}
              </Text>
            </View>
          </View>

          {isLoadingOffers ? (
            <View style={styles.offersState}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={styles.offerStateText}>Finding available tanks nearby…</Text>
            </View>
          ) : null}
          {!isLoadingOffers && !offersError && !deliveryLocation ? (
            <View style={styles.offersState}>
              <Text style={styles.offerStateText}>Allow location access or search for your address above to see nearby tank prices.</Text>
            </View>
          ) : null}
          {!isLoadingOffers && !offersError && deliveryLocation && nearbyOffers.length === 0 ? (
            <View style={styles.offersState}>
              <Text style={styles.offerStateText}>No available tanks found near your location.</Text>
            </View>
          ) : null}
          {!isLoadingOffers && !offersError && deliveryLocation && nearbyOffers.length > 0 ? (
            <View style={styles.tankerGrid}>
              {getSortedOffers(nearbyOffers).map((offer) => {
                const formattedPrice = Number(offer.displayedPrice).toLocaleString('en-IN');

                return (
                  <Pressable
                    key={offer.capacityLiters}
                    accessibilityRole="button"
                    style={styles.gridCard}
                    onPress={() => chooseOffer(offer)}
                  >
                    {/* Truck Image Container with Respective Litres */}
                    <View style={[styles.truckImageWrap, isSmallScreen && { height: 96 }]}>
                      <Image
                        source={getTankerImage(offer.capacityLiters)}
                        style={styles.truckImage}
                        resizeMode="contain"
                      />
                      {!hasTankerImage(offer.capacityLiters) ? (
                        <View style={styles.tankTextOverlay}>
                          <Text style={[styles.tankLitresText, isSmallScreen && { fontSize: 13 }]}>{offer.capacityLiters} L</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Card Content with Balanced Modern Alignment */}
                    <View style={[styles.cardContent, isSmallScreen && { paddingHorizontal: 9, paddingTop: 8, paddingBottom: 10 }]}>
                      {/* Capacity Label */}
                      <View style={styles.capacityRow}>
                        <View style={styles.statusDot} />
                        <Text style={[styles.capacityText, isSmallScreen && { fontSize: 12 }]}>{offer.capacityLiters} LTR</Text>
                      </View>

                      {/* Price & Book Now Action */}
                      <View style={styles.priceRow}>
                        <Text style={[styles.mainPrice, isSmallScreen && { fontSize: 14.5 }]}>₹{formattedPrice}</Text>
                        <Pressable
                          style={[styles.bookNowButton, isSmallScreen && { paddingHorizontal: 7, paddingVertical: 4 }]}
                          onPress={() => chooseOffer(offer)}
                        >
                          <Text style={[styles.bookNowText, isSmallScreen && { fontSize: 10.5 }]}>Book Now</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {/* Unavailable / Placeholder Card */}
              <View style={[styles.gridCard, styles.unavailableCard]}>
                <View style={styles.truckImageWrap}>
                  <Image
                    source={require('../../assets/tankers/truck_unavailable.png')}
                    style={[styles.truckImage, { opacity: 0.85 }]}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.skeletonWrap}>
                  <View style={styles.skeletonBar1} />
                  <View style={styles.skeletonBar2} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </PullToRefreshScrollView>

      {/* Location Selection & Address Search Modal - Blinkit Style */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissArea} onPress={() => setShowLocationModal(false)} />

          {/* White Bottom Sheet */}
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderTitleWrap}>
                <Ionicons name="location" size={20} color="#0751A8" style={{ marginRight: 8 }} />
                <Text style={styles.sheetTitle}>Select your Location</Text>
              </View>
              <Pressable
                style={styles.sheetCloseButton}
                onPress={() => setShowLocationModal(false)}
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
                value={addressQuery}
                onChangeText={(value) => {
                  selectedAddressQuery.current = '';
                  setAddressQuery(value);
                }}
                placeholder="search delivery location"
                placeholderTextColor="#94a3b8"
                autoFocus={true}
              />
              {isSearchingAddress ? (
                <ActivityIndicator size="small" color="#0284c7" />
              ) : addressQuery ? (
                <Pressable
                  onPress={() => {
                    setAddressQuery('');
                    setAddressResults([]);
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
              onPress={() => {
                setIsLoadingLocation(true);
                setLocationAttempt((a) => a + 1);
                setShowLocationModal(false);
              }}
            >
              <Ionicons name="locate" size={20} color="#16a34a" style={{ marginRight: 10 }} />
              <Text style={styles.useCurrentLocationText}>Use current location</Text>
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#16a34a" style={{ marginLeft: 'auto' }} />
              ) : null}
            </Pressable>

            {/* Search Results / Suggestions */}
            {addressResults.length > 0 ? (
              <ScrollView style={styles.modalResultsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalSectionLabel}>Suggestions</Text>
                {addressResults.map((result) => (
                  <Pressable
                    key={result.place_id}
                    style={styles.modalSearchResultItem}
                    onPress={() => selectAddress(result)}
                  >
                    <Ionicons name="location-outline" size={18} color="#64748b" style={{ marginRight: 12, marginTop: 2 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.modalResultMain} numberOfLines={1}>
                        {result.address?.neighbourhood || result.address?.suburb || result.address?.road || result.display_name.split(',')[0]}
                      </Text>
                      <Text style={styles.modalResultSub} numberOfLines={2}>
                        {formatAddress(result.address) || result.display_name}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <NotificationCenterModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationCountChange={setUnreadNotifCount}
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
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 135,
    alignSelf: 'center',
  },
  bodyContent: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 6,
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
    outlineWidth: 0,
    outlineStyle: 'none',
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
    color: '#15803d',
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
  heroBannerWrap: {
    position: 'relative',
    width: '100%',
    minHeight: 345 + ANDROID_STATUS_BAR,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroAbsoluteBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Platform.select({
      web: {
        objectPosition: '88% 50%',
      },
    }),
  },
  heroContentOverlay: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR + 16 : Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 12,
    zIndex: 2,
  },
  topLogoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 16,
  },
  topLocationSelector: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
    justifyContent: 'center',
  },
  topLocationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topLocationTitle: {
    ...TYPOGRAPHY.cardTitle,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    maxWidth: '84%',
  },
  topLocationSubtitle: {
    ...TYPOGRAPHY.captionSmall,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 2,
    letterSpacing: -0.1,
  },
  topActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#BAE6FD',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPOGRAPHY.cardTitle,
    color: '#0751A8',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 125,
    marginBottom: 20,
  },
  heroTextSide: {
    maxWidth: '56%',
    paddingRight: 6,
  },
  heroMainTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 26,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  heroAccentTitle: {
    color: '#00C2E9',
  },
  heroSubtitle: {
    ...TYPOGRAPHY.secondary,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 6,
  },
  heroTruckPlaceholder: {
    flex: 1,
  },
  featurePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 36, 75, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 7,
  },
  featurePillIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 194, 233, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featurePillTextWrap: {
    justifyContent: 'center',
  },
  featurePillSub: {
    fontSize: 9,
    color: '#BAE6FD',
    fontFamily: fontFamilies.medium,
    lineHeight: 11,
  },
  featurePillMain: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: fontFamilies.bold,
    lineHeight: 14,
  },
  heroCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00A3FF',
    shadowColor: '#00A3FF',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroCtaText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
  offerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: '#64748b',
    marginTop: 3,
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
  offersState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  offerEmptyTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 5,
    textAlign: 'center',
  },
  offerStateText: {
    color: '#64748b',
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
  offersError: {
    color: '#b91c1c',
    fontSize: 13,
    padding: 12,
  },
  tankerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    marginBottom: 20,
  },
  gridCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8EFF7',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0751A8',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  truckImageWrap: {
    width: '100%',
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  truckImage: {
    width: '100%',
    height: '100%',
  },
  tankTextOverlay: {
    position: 'absolute',
    left: '70%',
    top: '32%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tankLitresText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    fontWeight: '700',
    color: '#0751A8',
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  capacityText: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 13,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mainPrice: {
    ...TYPOGRAPHY.priceSmall,
    fontSize: 16.5,
    color: '#0751A8',
  },
  originalPrice: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    marginLeft: 4,
  },
  bookNowButton: {
    borderWidth: 1.2,
    borderColor: '#0751A8',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: '#F0F7FF',
  },
  bookNowText: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 11,
    color: '#0751A8',
  },
  unavailableCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  skeletonWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  skeletonBar1: {
    height: 12,
    width: '50%',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 10,
  },
  skeletonBar2: {
    height: 22,
    width: '90%',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  offerCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerTankIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    marginRight: 12,
  },
  offerMain: {
    flex: 1,
    minWidth: 0,
  },
  offerTankName: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 15,
    color: '#0f172a',
  },
  offerVendorName: {
    ...TYPOGRAPHY.captionSmall,
    color: '#64748b',
    marginTop: 3,
  },
  offerPrice: {
    ...TYPOGRAPHY.priceSmall,
    fontSize: 18,
    color: '#0284c7',
    marginLeft: 8,
  },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  offerSelect: {
    ...TYPOGRAPHY.buttonSmall,
    fontSize: 12.5,
    color: '#0284c7',
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
    ...TYPOGRAPHY.cardTitle,
    color: '#0f172a',
  },
  tankVolume: {
    ...TYPOGRAPHY.h1,
    marginTop: 10,
    fontSize: 26,
    color: '#0f172a',
  },
  tankPrice: {
    ...TYPOGRAPHY.priceSmall,
    marginTop: 8,
    fontSize: 18,
    color: '#0284c7',
  },
  tankBadge: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 10,
    fontSize: 11,
    color: '#475569',
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#0284c7',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
});
