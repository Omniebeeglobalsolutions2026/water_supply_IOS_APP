import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const tokenKey = 'waterflow.authToken';
const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://water-supply-backend-1ean.onrender.com/api';

async function getToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(tokenKey) || null;
  return SecureStore.getItemAsync(tokenKey);
}

async function storeToken(token) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(tokenKey, token);
    return;
  }
  await SecureStore.setItemAsync(tokenKey, token);
}

async function clearToken() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(tokenKey);
    return;
  }
  await SecureStore.deleteItemAsync(tokenKey);
}

async function request(path, { body, authenticated = false, method = body ? 'POST' : 'GET' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(`Cannot reach the WaterFlow API at ${apiBaseUrl}. Check that the backend is running and the app API URL is correct.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'The request could not be completed.');
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

async function saveSession(payload) {
  await storeToken(payload.token);
  return payload.user;
}

export const authApi = {
  async login(credentials) {
    return saveSession(await request('/auth/login', { body: credentials }));
  },
  async register(details) {
    const payload = await request('/auth/register', { body: details });
    return payload.token ? saveSession(payload) : payload;
  },
  async currentUser() {
    if (!(await getToken())) return null;
    return (await request('/auth/me', { authenticated: true })).user;
  },
  async updateProfile(details) {
    const res = await request('/auth/profile', { method: 'PUT', body: details, authenticated: true });
    return res.user;
  },
  clearSession: clearToken,
};

export const vendorApi = {
  async profile() {
    return (await request('/vendor/profile', { authenticated: true })).vendor;
  },
  async updateLocation(location) {
    return (await request('/vendor/location', { method: 'PUT', body: location, authenticated: true })).location;
  },
  async addTank(tank) {
    return (await request('/vendor/inventory', { body: tank, authenticated: true })).inventory;
  },
  async updateTank(id, tank) {
    return (await request(`/vendor/inventory/${encodeURIComponent(id)}`, { method: 'PATCH', body: tank, authenticated: true })).inventory;
  },
  async deleteTank(id) {
    return request(`/vendor/inventory/${encodeURIComponent(id)}`, { method: 'DELETE', authenticated: true });
  },
  async setWorkMode(enabled) {
    return request('/vendor/work-mode', { method: 'PATCH', body: { enabled }, authenticated: true });
  },
  async registerPushToken(token) {
    return request('/vendor/push-token', { body: { token }, method: 'PUT', authenticated: true });
  },
  async unregisterPushToken(token) {
    return request('/vendor/push-token', { method: 'DELETE', body: { token }, authenticated: true });
  },
  async registerCustomerPushToken(token) {
    return request('/user/push-token', { body: { token }, method: 'PUT', authenticated: true });
  },
  async unregisterCustomerPushToken(token) {
    return request('/user/push-token', { method: 'DELETE', body: { token }, authenticated: true });
  },
  async orders(status = 'all') {
    const query = new URLSearchParams({ status });
    return (await request(`/vendor/orders?${query}`, { authenticated: true })).orders;
  },
  async updateOrderStatus(id, status, requestId) {
    return (await request(`/vendor/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, requestId },
      authenticated: true,
    })).order;
  },
  async dashboard(period = 'monthly') {
    const query = new URLSearchParams({ period });
    return (await request(`/vendor/dashboard?${query}`, { authenticated: true })).dashboard;
  },
  async createOrder(details) {
    return (await request('/orders', { body: details, authenticated: true })).order;
  },
  async createRazorpayOrder(details) {
    return request('/payments/razorpay/orders', { body: details, authenticated: true });
  },
  async verifyRazorpayPayment(payment) {
    return request('/payments/razorpay/verify', { body: payment, authenticated: true });
  },
  async customerOrders() {
    return (await request('/orders', { authenticated: true })).orders;
  },
  async cancelCustomerOrder(id) {
    return (await request(`/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      authenticated: true,
    })).order;
  },
  async nearbyOffers({ latitude, longitude }) {
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
    });
    return (await request(`/vendors/nearby?${query}`)).offers;
  },
};