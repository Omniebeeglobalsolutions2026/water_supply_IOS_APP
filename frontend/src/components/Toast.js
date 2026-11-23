import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

export default function Toast({
  message,
  type = 'info',
  onDismiss,
  duration,
}) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const effectiveDuration = duration !== undefined
    ? duration
    : (type === 'success' ? 3200 : 4500);

  useEffect(() => {
    if (!message) {
      opacity.setValue(0);
      translateY.setValue(-60);
      return;
    }

    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, effectiveDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, effectiveDuration]);

  const handleDismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handleDismiss}
        style={[
          styles.toastCard,
          isSuccess && styles.cardSuccess,
          isError && styles.cardError,
        ]}
      >
        <View style={[styles.iconCircle, isSuccess && styles.iconCircleSuccess, isError && styles.iconCircleError]}>
          <Text style={[styles.iconText, isSuccess && styles.iconTextSuccess, isError && styles.iconTextError]}>
            {isSuccess ? '✓' : isError ? '!' : 'ℹ'}
          </Text>
        </View>

        <Text
          style={[styles.messageText, isSuccess && styles.messageTextSuccess, isError && styles.messageTextError]}
          numberOfLines={3}
        >
          {message}
        </Text>

        <Pressable hitSlop={10} onPress={handleDismiss} style={styles.closeButton}>
          <Text style={[styles.closeIcon, isSuccess && styles.closeSuccess, isError && styles.closeError]}>✕</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 99999,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 10,
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  cardSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  cardError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSuccess: {
    backgroundColor: '#dcfce7',
  },
  iconCircleError: {
    backgroundColor: '#fee2e2',
  },
  iconText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284c7',
  },
  iconTextSuccess: {
    color: '#16a34a',
  },
  iconTextError: {
    color: '#dc2626',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 19,
  },
  messageTextSuccess: {
    color: '#15803d',
  },
  messageTextError: {
    color: '#b91c1c',
  },
  closeButton: {
    padding: 4,
    marginLeft: 2,
  },
  closeIcon: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  closeSuccess: {
    color: '#16a34a',
  },
  closeError: {
    color: '#dc2626',
  },
});
