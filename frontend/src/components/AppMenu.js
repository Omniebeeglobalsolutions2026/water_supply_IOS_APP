import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';

export default function AppMenu({ isOpen, isLoggedIn, loginRole, currentUser, onClose, onSelect, onLoginToggle }) {
  if (!isOpen) return null;

  const roleNames = {
    user: 'User Portal',
    vendor: 'Vendor Portal',
  };

  const menuItems = [
    { label: 'My profile', icon: '👤', screen: 'my-profile' },
    { label: 'Terms & conditions', icon: '📄', screen: 'terms' },
    { label: 'Privacy policy', icon: '🛡️', screen: 'privacy' },
  ];

  return (
    <Modal
      visible={Boolean(isOpen)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.overlayTouch} onPress={onClose} accessibilityLabel="Close menu" />
        <View style={styles.menuPanel}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuScroll}>
            <View style={styles.menuHeader}>
              <View style={styles.brandLogoWrap}>
                <Image
                  source={require('../../assets/bhagira_logo_brand.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.menuHeaderTextWrap}>
                <Text style={styles.menuName}>BHAGIRA</Text>
                <Text style={styles.menuEmail}>
                  {isLoggedIn
                    ? `${currentUser?.businessName || currentUser?.name || 'Account'} • ${roleNames[loginRole] || 'User Portal'}`
                    : 'Guest User'}
                </Text>
              </View>
            </View>

            {menuItems.map((item) => (
              <Pressable
                key={item.label}
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onSelect(item.screen);
                }}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuText}>{item.label}</Text>
              </Pressable>
            ))}

            {isLoggedIn ? (
              <Pressable
                style={styles.logoutButtonMenu}
                onPress={() => {
                  onClose();
                  onLoginToggle();
                }}
              >
                <Text style={styles.logoutButtonMenuText}>Logout</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.loginButtonMenu}
                onPress={() => {
                  onClose();
                  onSelect('login');
                }}
              >
                <Text style={styles.loginButtonMenuText}>Login</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    flexDirection: 'row',
    zIndex: 99999,
    elevation: 99999,
  },
  overlayTouch: {
    flex: 1,
  },
  menuPanel: {
    width: '80%',
    maxWidth: 360,
    height: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: -4, height: 0 },
    elevation: 20,
  },
  menuScroll: {
    paddingTop: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 36) + 24 : 54,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  brandLogoWrap: {
    width: 68,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  menuHeaderTextWrap: {
    flex: 1,
  },
  menuName: {
    ...TYPOGRAPHY.sectionTitle,
    color: '#0f172a',
  },
  menuEmail: {
    ...TYPOGRAPHY.captionSmall,
    color: '#64748b',
    marginTop: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#edf4fa',
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuText: {
    ...TYPOGRAPHY.cardTitle,
    color: '#1e293b',
  },
  loginButtonMenu: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  loginButtonMenuText: {
    ...TYPOGRAPHY.button,
    color: '#fff',
  },
  logoutButtonMenu: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutButtonMenuText: {
    ...TYPOGRAPHY.button,
    color: '#dc2626',
  },
});
