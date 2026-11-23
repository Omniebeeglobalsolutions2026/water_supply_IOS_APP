import { Linking, Platform, Share } from 'react-native';

export const formatOrderShareText = (order) => {
  if (!order) return '';

  const customerName = order.customer || order.customerName || 'Customer';
  const customerPhone = order.customerPhone || order.phone || 'Not provided';
  const address = order.location || order.deliveryAddress || 'Address not specified';
  const capacity = order.capacityLiters || order.capacity || 1000;
  const liters = `${Number(capacity).toLocaleString('en-IN')} LTR`;
  const waterType = order.waterSource
    ? `${order.waterSource.charAt(0).toUpperCase() + order.waterSource.slice(1)} Water`
    : 'Clean Water';
  const slot = `${order.date || 'Today'} · ${order.time || 'Standard Delivery'}`;
  const amount = Number(order.amount || 0).toLocaleString('en-IN');
  const payment = order.paymentStatus === 'paid' ? 'Paid Online' : 'Pay on Delivery';
  const status = (order.status || 'Confirmed').charAt(0).toUpperCase() + (order.status || 'Confirmed').slice(1);
  const orderId = order.id ? `#${String(order.id).slice(-6).toUpperCase()}` : '';

  return (
`💧 *BHAGIRA - Water Tanker Order Details* ${orderId}

👤 *Customer Name:* ${customerName}
📱 *Mobile Number:* ${customerPhone}
📍 *Delivery Location:* ${address}
🚛 *Tanker Capacity:* ${liters}
💧 *Water Type:* ${waterType}
⏰ *Delivery Slot:* ${slot}
💰 *Amount:* ₹${amount} (${payment})
📌 *Status:* ${status}

_Delivered through BHAGIRA Clean Water Management_`
  );
};

export const shareToWhatsApp = async (order) => {
  const text = formatOrderShareText(order);
  const encoded = encodeURIComponent(text);
  const mobileUrl = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://api.whatsapp.com/send?text=${encoded}`;

  try {
    if (Platform.OS === 'web') {
      window.open(webUrl, '_blank');
      return true;
    }
    const supported = await Linking.canOpenURL(mobileUrl);
    if (supported) {
      await Linking.openURL(mobileUrl);
    } else {
      await Linking.openURL(webUrl);
    }
    return true;
  } catch (err) {
    if (Platform.OS === 'web') {
      window.open(webUrl, '_blank');
      return true;
    }
    return false;
  }
};

export const shareToSms = async (order) => {
  const text = formatOrderShareText(order);
  const encoded = encodeURIComponent(text);
  const phone = order?.customerPhone ? order.customerPhone.replace(/[^0-9+]/g, '') : '';
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phone}${separator}body=${encoded}`;

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

export const copyOrderToClipboard = async (order) => {
  const text = formatOrderShareText(order);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  return false;
};

export const nativeShareOrder = async (order) => {
  const text = formatOrderShareText(order);
  const title = `BHAGIRA Water Tanker Order - ${order?.customer || 'Delivery'}`;

  // 1. Try web navigator.share if available
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }

  // 2. Try React Native Share
  try {
    const result = await Share.share({
      title,
      message: text,
    });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
};
