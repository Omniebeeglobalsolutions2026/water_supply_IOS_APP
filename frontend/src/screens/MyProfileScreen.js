import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ScreenHeader from '../components/ScreenHeader';
import Toast from '../components/Toast';
import { authApi, vendorApi } from '../authApi';
import { TYPOGRAPHY } from '../theme/typography';

async function resolveAddressFromCoords(latitude, longitude) {
  // 1. Try native expo-location reverse geocoding
  try {
    if (Location && Location.reverseGeocodeAsync) {
      const nativeResults = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (Array.isArray(nativeResults) && nativeResults.length > 0) {
        const item = nativeResults[0];
        const parts = [
          item.name && item.name !== item.street ? item.name : null,
          item.street,
          item.subregion || item.district || item.city,
          item.city && item.city !== (item.subregion || item.district) ? item.city : null,
          item.region,
          item.postalCode,
        ].filter(Boolean);
        const built = [...new Set(parts)].join(', ');
        if (built && built.length > 3) return built;
      }
    }
  } catch (err) {
    console.warn('Native reverseGeocode error:', err);
  }

  // 2. Fallback to OpenStreetMap Nominatim reverse geocode
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'BHAGIRA-WaterApp/1.0 (contact: support@bhagira.com)',
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) return data.display_name;
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode error:', err);
  }

  return `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
}

export default function MyProfileScreen({
  role = 'user',
  currentUser,
  isLoggedIn,
  onOpenMenu,
  onBackPress,
  onUpdateUser,
  onGoToLogin,
  onNavigate,
}) {
  const isVendor = role === 'vendor' || currentUser?.role === 'vendor';

  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [businessName, setBusinessName] = useState(currentUser?.businessName || '');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCoordinates, setBusinessCoordinates] = useState(null);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [isLoadingVendor, setIsLoadingVendor] = useState(false);

  // Location search suggestions & GPS state
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');

  // Keep state synced with currentUser
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      if (currentUser.businessName) {
        setBusinessName(currentUser.businessName);
      }
    }
  }, [currentUser]);

  // If vendor, fetch comprehensive vendor profile (businessName, hub location, inventory)
  useEffect(() => {
    let isMounted = true;
    if (!isVendor || !isLoggedIn) return;

    setIsLoadingVendor(true);
    vendorApi
      .profile()
      .then((profile) => {
        if (!isMounted || !profile) return;
        setVendorProfile(profile);
        if (profile.businessName) setBusinessName(profile.businessName);
        if (profile.name) setName(profile.name);
        if (profile.phone) setPhone(profile.phone);
        if (profile.email) setEmail(profile.email);
        if (profile.location?.address) {
          setBusinessAddress(profile.location.address);
          setAddressSearchQuery(profile.location.address);
        }
        if (profile.location?.latitude && profile.location?.longitude) {
          setBusinessCoordinates({
            latitude: profile.location.latitude,
            longitude: profile.location.longitude,
          });
        }
        if (Array.isArray(profile.inventory)) setInventory(profile.inventory);
      })
      .catch((err) => {
        console.warn('Could not fetch vendor profile:', err?.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingVendor(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isVendor, isLoggedIn]);

  // Debounced search for Nominatim location suggestions when editing
  useEffect(() => {
    if (!isEditing || !isVendor) {
      setLocationSuggestions([]);
      return;
    }

    const query = (addressSearchQuery || '').trim();
    if (query.length < 3 || query === businessAddress) {
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    let active = true;
    setIsSearchingLocation(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'BHAGIRA-WaterApp/1.0 (contact: support@bhagira.com)',
            },
          }
        );
        if (!res.ok) throw new Error('Search failed');
        const results = await res.json();
        if (active) {
          setLocationSuggestions(Array.isArray(results) ? results : []);
        }
      } catch (e) {
        if (active) setLocationSuggestions([]);
      } finally {
        if (active) setIsSearchingLocation(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [addressSearchQuery, isEditing, isVendor, businessAddress]);

  // Use Current GPS Location handler
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      let coords = null;

      // Check permission via expo-location
      if (Location && Location.requestForegroundPermissionsAsync) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (loc?.coords) {
              coords = loc.coords;
            }
          }
        } catch (e) {
          console.warn('expo-location error:', e);
        }
      }

      // Web fallback if expo-location didn't return coords
      if (!coords && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => {
              console.warn('HTML5 geolocation error:', err);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
          );
        });
      }

      if (!coords) {
        setToastMessage('Could not detect location. Please check browser/device permissions.');
        setToastType('error');
        return;
      }

      const { latitude, longitude } = coords;
      setBusinessCoordinates({ latitude, longitude });

      // Reverse geocode to readable address
      const resolved = await resolveAddressFromCoords(latitude, longitude);
      setBusinessAddress(resolved);
      setAddressSearchQuery(resolved);
      setLocationSuggestions([]);
      setToastMessage('Operating hub updated from current location!');
      setToastType('success');
    } catch (err) {
      setToastMessage(err.message || 'Unable to get current location');
      setToastType('error');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelectSuggestion = (item) => {
    const address = item.display_name || item.name || '';
    setBusinessAddress(address);
    setAddressSearchQuery(address);
    if (item.lat && item.lon) {
      setBusinessCoordinates({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      });
    }
    setLocationSuggestions([]);
  };

  // Fetch orders to extract unique delivery addresses (ONLY for customers)
  useEffect(() => {
    let isMounted = true;
    if (isVendor || !isLoggedIn) {
      setSavedAddresses([]);
      return;
    }

    setIsLoadingAddresses(true);
    vendorApi
      .customerOrders()
      .then((orders) => {
        if (!isMounted) return;
        const seen = new Set();
        const deduplicated = [];

        (Array.isArray(orders) ? orders : []).forEach((order) => {
          const addr = (order.deliveryAddress || order.location || '').trim();
          if (addr && addr.length > 3) {
            const key = addr.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              deduplicated.push({
                id: order.id || order._id || `addr-${deduplicated.length}`,
                address: addr,
                date: order.deliveryDate || order.date || 'Recent Order',
              });
            }
          }
        });

        setSavedAddresses(deduplicated);
      })
      .catch((err) => {
        console.warn('Could not fetch orders for saved addresses:', err?.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAddresses(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isVendor, isLoggedIn]);

  const handleSaveProfile = async () => {
    if (isVendor && !businessName.trim()) {
      setToastMessage('Please enter your business or agency name');
      setToastType('error');
      return;
    }
    if (!name.trim()) {
      setToastMessage(isVendor ? 'Please enter proprietor / owner name' : 'Please enter your full name');
      setToastType('error');
      return;
    }
    if (!phone.trim()) {
      setToastMessage('Please enter your mobile number');
      setToastType('error');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setToastMessage('Please enter a valid email address');
      setToastType('error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        ...(isVendor ? { businessName: businessName.trim() } : {}),
      };

      let updated = null;
      try {
        updated = await authApi.updateProfile(payload);
      } catch (apiErr) {
        console.warn('API updateProfile failed, updating local state:', apiErr.message);
        updated = {
          ...currentUser,
          ...payload,
        };
      }

      if (isVendor && businessAddress.trim()) {
        try {
          await vendorApi.updateLocation({
            address: businessAddress.trim(),
            ...(businessCoordinates || {}),
          });
        } catch (locErr) {
          console.warn('Could not update vendor location:', locErr.message);
        }
      }

      if (onUpdateUser && updated) {
        onUpdateUser(updated);
      }
      setIsEditing(false);
      setLocationSuggestions([]);
      setToastMessage(isVendor ? 'Vendor profile updated successfully!' : 'Profile updated successfully!');
      setToastType('success');
    } catch (err) {
      setToastMessage(err.message || 'Failed to update profile');
      setToastType('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setName(currentUser?.name || '');
    setPhone(currentUser?.phone || '');
    setEmail(currentUser?.email || '');
    if (isVendor) {
      setBusinessName(vendorProfile?.businessName || currentUser?.businessName || '');
      const addr = vendorProfile?.location?.address || '';
      setBusinessAddress(addr);
      setAddressSearchQuery(addr);
      setLocationSuggestions([]);
    }
    setIsEditing(false);
  };

  const displayTitle = isVendor
    ? businessName || currentUser?.businessName || name || 'Vendor Account'
    : name || currentUser?.name || (isLoggedIn ? 'Customer' : 'Guest User');

  const avatarInitial = (
    (displayTitle ? displayTitle.trim().charAt(0).toUpperCase() : '') ||
    (isLoggedIn ? (isVendor ? 'V' : 'U') : 'G')
  );

  return (
    <View style={styles.screenShell}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header properly aligned with page margins */}
          <ScreenHeader
            label={isVendor ? 'Supplier Account' : 'Account'}
            title={isVendor ? 'Vendor Profile' : 'My Profile'}
            onBackPress={onBackPress}
            onMenuPress={onOpenMenu}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
          />

          {/* User / Vendor Hero Banner Card */}
          <View style={styles.heroCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {isLoggedIn ? displayTitle : 'Guest User'}
              </Text>
              <View style={styles.roleBadgeRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isLoggedIn ? '#10B981' : '#94A3B8' },
                  ]}
                />
                <Text style={styles.avatarRole}>
                  {isLoggedIn
                    ? isVendor
                      ? 'Verified Supplier'
                      : 'Verified Customer'
                    : 'Not signed in'}
                </Text>
              </View>
              {isVendor && businessAddress ? (
                <View style={styles.heroLocationRow}>
                  <Ionicons name="location-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text numberOfLines={1} style={styles.heroLocationText}>
                    {businessAddress}
                  </Text>
                </View>
              ) : null}
            </View>
            {isLoggedIn ? (
              <Pressable
                style={[styles.editPill, isEditing && styles.editPillActive]}
                onPress={() => (isEditing ? handleCancelEdit() : setIsEditing(true))}
              >
                <Ionicons
                  name={isEditing ? 'close' : 'pencil'}
                  size={14}
                  color={isEditing ? '#EF4444' : '#0284C7'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.editPillText, isEditing && { color: '#EF4444' }]}>
                  {isEditing ? 'Cancel' : 'Edit'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Guest State Prompt */}
          {!isLoggedIn ? (
            <View style={styles.guestCard}>
              <View style={styles.guestIconWrap}>
                <Ionicons name="person-circle-outline" size={44} color="#0284C7" />
              </View>
              <Text style={styles.guestTitle}>Sign in to view your details</Text>
              <Text style={styles.guestSubtitle}>
                Log in or create a BHAGIRA account to view your profile, manage bookings, and access your account.
              </Text>
              <Pressable style={styles.guestLoginBtn} onPress={onGoToLogin}>
                <Text style={styles.guestLoginBtnText}>Log In / Sign Up</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </Pressable>
            </View>
          ) : (
            <>
              {/* Details Card: Vendor vs Customer */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionIconWrap}>
                    <Ionicons
                      name={isVendor ? 'business' : 'person'}
                      size={16}
                      color="#0284C7"
                    />
                  </View>
                  <Text style={styles.sectionTitle}>
                    {isVendor ? 'Business & Vendor Details' : 'Personal Details'}
                  </Text>
                </View>

                {/* Business Name (Vendor only) */}
                {isVendor ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Business / Agency Name</Text>
                    <View
                      style={[
                        styles.inputBox,
                        isEditing ? styles.inputBoxEditing : styles.inputBoxReadOnly,
                      ]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={18}
                        color={isEditing ? '#0284C7' : '#94A3B8'}
                        style={styles.fieldIcon}
                      />
                      {isEditing ? (
                        <TextInput
                          style={styles.textInput}
                          value={businessName}
                          onChangeText={setBusinessName}
                          placeholder="Enter business name"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="words"
                        />
                      ) : (
                        <Text style={styles.readOnlyText}>{businessName || 'Not provided'}</Text>
                      )}
                    </View>
                  </View>
                ) : null}

                {/* Full Name / Proprietor Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {isVendor ? 'Proprietor / Contact Person' : 'Full Name'}
                  </Text>
                  <View
                    style={[
                      styles.inputBox,
                      isEditing ? styles.inputBoxEditing : styles.inputBoxReadOnly,
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={isEditing ? '#0284C7' : '#94A3B8'}
                      style={styles.fieldIcon}
                    />
                    {isEditing ? (
                      <TextInput
                        style={styles.textInput}
                        value={name}
                        onChangeText={setName}
                        placeholder={isVendor ? 'Enter proprietor name' : 'Enter your name'}
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="words"
                      />
                    ) : (
                      <Text style={styles.readOnlyText}>{name || 'Not provided'}</Text>
                    )}
                  </View>
                </View>

                {/* Mobile Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View
                    style={[
                      styles.inputBox,
                      isEditing ? styles.inputBoxEditing : styles.inputBoxReadOnly,
                    ]}
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={isEditing ? '#0284C7' : '#94A3B8'}
                      style={styles.fieldIcon}
                    />
                    {isEditing ? (
                      <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Enter mobile number"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    ) : (
                      <Text style={styles.readOnlyText}>{phone || 'Not provided'}</Text>
                    )}
                  </View>
                </View>

                {/* Email Address */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View
                    style={[
                      styles.inputBox,
                      isEditing ? styles.inputBoxEditing : styles.inputBoxReadOnly,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={isEditing ? '#0284C7' : '#94A3B8'}
                      style={styles.fieldIcon}
                    />
                    {isEditing ? (
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter email address"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    ) : (
                      <Text style={styles.readOnlyText}>{email || 'Not provided'}</Text>
                    )}
                  </View>
                </View>

                {/* Action Buttons when Editing */}
                {isEditing ? (
                  <View style={styles.editActionRow}>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.saveBtn, isSaving && { opacity: 0.75 }]}
                      onPress={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-sharp"
                            size={17}
                            color="#FFFFFF"
                            style={{ marginRight: 5 }}
                          />
                          <Text style={styles.saveBtnText}>Save Changes</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {/* Lower Section: Vendor Hub & Fleet vs Customer Saved Addresses */}
              {isVendor ? (
                <>
                  {/* Operating Hub & Dispatch Station */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionTitleRow}>
                      <View style={styles.sectionIconWrap}>
                        <Ionicons name="location" size={16} color="#0751A8" />
                      </View>
                      <Text style={styles.sectionTitle}>Operating Hub & Service Location</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      Your registered dispatch station where tankers are operated and dispatched.
                    </Text>

                    {isLoadingVendor ? (
                      <View style={styles.loadingWrap}>
                        <ActivityIndicator size="small" color="#0284C7" />
                        <Text style={styles.loadingText}>Fetching operating location...</Text>
                      </View>
                    ) : isEditing ? (
                      <View>
                        {/* Use Current GPS Location Action Button */}
                        <Pressable
                          style={[styles.currentLocationBtn, isLocating && styles.currentLocationBtnDisabled]}
                          onPress={handleUseCurrentLocation}
                          disabled={isLocating}
                        >
                          {isLocating ? (
                            <ActivityIndicator size="small" color="#0284C7" style={{ marginRight: 8 }} />
                          ) : (
                            <Ionicons name="locate" size={18} color="#0284C7" style={{ marginRight: 8 }} />
                          )}
                          <Text style={styles.currentLocationBtnText}>
                            {isLocating ? 'Detecting Current Location...' : 'Use Current Location'}
                          </Text>
                        </Pressable>

                        {/* Search / Edit Hub Address Input */}
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Operating Hub Address</Text>
                          <View
                            style={[
                              styles.inputBox,
                              styles.inputBoxEditing,
                              { minHeight: 48 },
                            ]}
                          >
                            <Ionicons
                              name="search-outline"
                              size={18}
                              color="#0284C7"
                              style={styles.fieldIcon}
                            />
                            <TextInput
                              style={styles.textInput}
                              value={addressSearchQuery || businessAddress}
                              onChangeText={(text) => {
                                setBusinessAddress(text);
                                setAddressSearchQuery(text);
                              }}
                              placeholder="Search area, landmark or street..."
                              placeholderTextColor="#94A3B8"
                            />
                            {isSearchingLocation ? (
                              <ActivityIndicator size="small" color="#0284C7" />
                            ) : (addressSearchQuery || businessAddress) ? (
                              <Pressable
                                onPress={() => {
                                  setBusinessAddress('');
                                  setAddressSearchQuery('');
                                  setLocationSuggestions([]);
                                }}
                                hitSlop={8}
                              >
                                <Ionicons name="close-circle" size={18} color="#94A3B8" />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>

                        {/* Search Suggestions Dropdown */}
                        {locationSuggestions.length > 0 ? (
                          <View style={styles.suggestionsDropdown}>
                            {locationSuggestions.map((item, idx) => (
                              <Pressable
                                key={item.place_id || idx}
                                style={[
                                  styles.suggestionItem,
                                  idx === locationSuggestions.length - 1 && { borderBottomWidth: 0 },
                                ]}
                                onPress={() => handleSelectSuggestion(item)}
                              >
                                <View style={styles.suggestionIconWrap}>
                                  <Ionicons name="location-sharp" size={16} color="#0284C7" />
                                </View>
                                <View style={styles.suggestionTextWrap}>
                                  <Text style={styles.suggestionPrimaryText} numberOfLines={1}>
                                    {item.name || (item.display_name ? item.display_name.split(',')[0] : '')}
                                  </Text>
                                  <Text style={styles.suggestionSecondaryText} numberOfLines={2}>
                                    {item.display_name}
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}

                        {/* Selected Hub Address confirmation preview */}
                        {businessAddress ? (
                          <View style={styles.selectedAddressPreview}>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color="#10B981"
                              style={{ marginRight: 6, marginTop: 1 }}
                            />
                            <Text style={styles.selectedAddressPreviewText} numberOfLines={2}>
                              Selected: {businessAddress}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.hubCard}>
                        <View style={styles.hubIconWrap}>
                          <Ionicons name="location" size={20} color="#0751A8" />
                        </View>
                        <View style={styles.hubContent}>
                          <View style={styles.hubBadgeRow}>
                            <Text style={styles.hubTag}>Primary Dispatch Hub</Text>
                            <View style={styles.activeHubBadge}>
                              <Text style={styles.activeHubBadgeText}>Active Hub</Text>
                            </View>
                          </View>
                          <Text style={styles.hubAddressText}>
                            {businessAddress ||
                              'No operating address set yet. Tap Edit above or below to set your dispatch hub.'}
                          </Text>

                          {/* Quick change location button */}
                          <Pressable
                            style={styles.changeHubBtn}
                            onPress={() => setIsEditing(true)}
                          >
                            <Ionicons name="locate-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                            <Text style={styles.changeHubBtnText}>Change Location / Use GPS</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Fleet Overview Card */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: '#EBF5FF' }]}>
                        <Ionicons name="water" size={16} color="#0751A8" />
                      </View>
                      <Text style={styles.sectionTitle}>Fleet & Capacity</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      Manage your registered water tankers, capacities, and pricing.
                    </Text>

                    <View style={styles.fleetSummaryCard}>
                      <View style={styles.fleetSummaryLeft}>
                        <Text style={styles.fleetCountNumber}>{inventory.length}</Text>
                        <Text style={styles.fleetCountLabel}>Tankers Configured</Text>
                        <Text style={styles.fleetAvailableLabel}>
                          ● {inventory.filter((t) => t.available !== false).length} Active & Ready
                        </Text>
                      </View>
                      <Pressable
                        style={styles.fleetActionBtn}
                        onPress={() => (onNavigate ? onNavigate('vendor-portal', 'inventory') : null)}
                      >
                        <Text style={styles.fleetActionBtnText}>Manage Fleet</Text>
                        <Ionicons name="chevron-forward" size={15} color="#0751A8" />
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                /* Customer Saved Delivery Addresses Card */
                <View style={styles.sectionCard}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons name="location" size={16} color="#0751A8" />
                    </View>
                    <Text style={styles.sectionTitle}>Saved Delivery Addresses</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Addresses saved automatically from your tanker bookings (no duplicates).
                  </Text>

                  {isLoadingAddresses ? (
                    <View style={styles.loadingWrap}>
                      <ActivityIndicator size="small" color="#0284C7" />
                      <Text style={styles.loadingText}>Fetching saved addresses...</Text>
                    </View>
                  ) : savedAddresses.length === 0 ? (
                    <View style={styles.emptyAddressWrap}>
                      <View style={styles.emptyIconCircle}>
                        <Ionicons name="navigate-outline" size={26} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyAddressTitle}>No saved addresses yet</Text>
                      <Text style={styles.emptyAddressSub}>
                        Delivery locations from your completed tanker orders will be saved here automatically.
                      </Text>
                    </View>
                  ) : (
                    savedAddresses.map((item, idx) => (
                      <View key={item.id || idx} style={styles.addressCard}>
                        <View style={styles.addressIconWrap}>
                          <Ionicons name="location-sharp" size={18} color="#0751A8" />
                        </View>
                        <View style={styles.addressContent}>
                          <View style={styles.addressHeaderRow}>
                            <Text style={styles.addressTag}>Address {idx + 1}</Text>
                            {idx === 0 ? (
                              <View style={styles.primaryBadge}>
                                <Text style={styles.primaryBadgeText}>Most Recent</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.addressText}>{item.address}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={toastMessage}
        type={toastType}
        onHide={() => setToastMessage('')}
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
  keyboardAvoid: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
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
  heroCard: {
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
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0751A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    ...TYPOGRAPHY.screenHeading,
    fontSize: 22,
    color: '#FFFFFF',
  },
  avatarInfo: {
    flex: 1,
  },
  avatarName: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 17,
    color: '#0F172A',
    marginBottom: 2,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  avatarRole: {
    ...TYPOGRAPHY.secondary,
    fontSize: 13,
    color: '#64748B',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heroLocationText: {
    ...TYPOGRAPHY.secondary,
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  editPillActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  editPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
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
  guestIconWrap: {
    marginBottom: 12,
  },
  guestTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  guestSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  guestLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  guestLoginBtnText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0751A8',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 16,
    color: '#0F172A',
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.secondary,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 13,
  },
  inputLabel: {
    ...TYPOGRAPHY.inputLabel,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputBoxReadOnly: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  inputBoxEditing: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  fieldIcon: {
    marginRight: 10,
  },
  readOnlyText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  textInput: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: '#0F172A',
    flex: 1,
    height: '100%',
  },
  editActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
    color: '#64748B',
  },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  saveBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
    color: '#FFFFFF',
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  currentLocationBtnDisabled: {
    opacity: 0.7,
  },
  currentLocationBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
  },
  suggestionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#0751A8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  suggestionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionPrimaryText: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    ...TYPOGRAPHY.secondary,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  selectedAddressPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  selectedAddressPreviewText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#166534',
    flex: 1,
    lineHeight: 16,
  },
  changeHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeHubBtnText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: '#64748B',
    marginLeft: 10,
  },
  emptyAddressWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyAddressTitle: {
    ...TYPOGRAPHY.cardTitle,
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  emptyAddressSub: {
    ...TYPOGRAPHY.secondary,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  addressIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  addressContent: {
    flex: 1,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressTag: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: '#0751A8',
  },
  primaryBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  addressText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
  hubCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  hubIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  hubContent: {
    flex: 1,
  },
  hubBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hubTag: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#0751A8',
  },
  activeHubBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeHubBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  hubAddressText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
  fleetSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  fleetSummaryLeft: {
    flex: 1,
  },
  fleetCountNumber: {
    ...TYPOGRAPHY.sectionHeading,
    fontSize: 22,
    color: '#0751A8',
  },
  fleetCountLabel: {
    ...TYPOGRAPHY.secondary,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  fleetAvailableLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  fleetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fleetActionBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 13,
    color: '#0751A8',
    marginRight: 4,
  },
});
