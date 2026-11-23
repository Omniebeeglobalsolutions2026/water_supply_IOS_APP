import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

const NOTIFICATIONS_STORAGE_KEY = 'waterflow.notifications';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: '💧 Welcome to BHAGIRA!',
    body: 'Clean water delivered at your doorstep in 30-45 minutes. Book your first tanker now.',
    time: 'Just now',
    timestamp: Date.now() - 60000 * 5,
    read: false,
    type: 'welcome',
  },
  {
    id: 'notif-2',
    title: '🚚 Express Delivery Available',
    body: 'Verified water tankers are active near your location in Kukatpally.',
    time: '10m ago',
    timestamp: Date.now() - 60000 * 10,
    read: false,
    type: 'system',
  },
  {
    id: 'notif-3',
    title: '🛡️ Quality Verified',
    body: 'TDS tested & multi-stage filtered water for residential and commercial supply.',
    time: '1h ago',
    timestamp: Date.now() - 60000 * 60,
    read: true,
    type: 'quality',
  },
];

export const getStoredNotifications = () => {
  if (Platform.OS === 'web' && globalThis.localStorage) {
    try {
      const raw = globalThis.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return DEFAULT_NOTIFICATIONS;
};

export const saveNotifications = (notifications) => {
  if (Platform.OS === 'web' && globalThis.localStorage) {
    try {
      globalThis.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch {}
  }
};

export const triggerHaptic = (style = 'light') => {
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      if (style === 'heavy') {
        Vibration.vibrate([40, 60, 40]);
      } else if (style === 'medium') {
        Vibration.vibrate(35);
      } else {
        Vibration.vibrate(20);
      }
    } else if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(style === 'heavy' ? [40, 60, 40] : 25);
    }
  } catch {}
};

export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
      return Notification.permission === 'granted';
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

export const sendLocalNotification = async ({ title, body, data = {} }) => {
  triggerHaptic('medium');

  try {
    // 1. Native mobile notification via expo-notifications
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
      },
      trigger: null, // instant
    });
  } catch {
    // Fallback for Web browser native notification
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        }
      }
    } catch {}
  }

  // Save to persistent notification history
  try {
    const list = getStoredNotifications();
    const newNotif = {
      id: `notif-${Date.now()}`,
      title,
      body,
      time: 'Just now',
      timestamp: Date.now(),
      read: false,
      data,
    };
    const updated = [newNotif, ...list.slice(0, 24)];
    saveNotifications(updated);
    return newNotif;
  } catch {
    return null;
  }
};
