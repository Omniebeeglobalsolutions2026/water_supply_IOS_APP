import React, { forwardRef, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPOGRAPHY, fontFamilies } from '../theme/typography';
import { triggerHaptic } from '../utils/mobileNotifications';

const PULL_THRESHOLD = 70;

const PullToRefreshScrollView = forwardRef(function PullToRefreshScrollView(
  {
    children,
    onRefresh,
    refreshing = false,
    style,
    contentContainerStyle,
    onScroll,
    scrollEventThrottle = 16,
    refreshMessage = 'Refreshing latest water supply...',
    ...rest
  },
  forwardedRef
) {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const scrollY = useRef(0);
  const internalScrollRef = useRef(null);

  const isCurrentlyRefreshing = refreshing || internalRefreshing;

  const handleNativeScroll = useCallback(
    (e) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll]
  );

  const handleRefresh = useCallback(async () => {
    if (isCurrentlyRefreshing || !onRefresh) return;
    triggerHaptic('medium');
    setInternalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setInternalRefreshing(false);
      setPullDistance(0);
      triggerHaptic('light');
    }
  }, [isCurrentlyRefreshing, onRefresh]);

  // Touch handlers for mobile web and gestures
  const handleTouchStart = (e) => {
    if (scrollY.current <= 5) {
      startY.current = e.nativeEvent.pageY || e.nativeEvent.clientY || 0;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current || isCurrentlyRefreshing) return;
    const currentY = e.nativeEvent.pageY || e.nativeEvent.clientY || 0;
    const diff = currentY - startY.current;
    if (diff > 0 && scrollY.current <= 5) {
      // Apply rubber-band resistance
      const resistedDistance = Math.min(Math.pow(diff, 0.82) * 2.2, 110);
      setPullDistance(resistedDistance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !isCurrentlyRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const isTriggered = pullDistance >= PULL_THRESHOLD;

  return (
    <View
      style={styles.wrapper}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...(Platform.OS === 'web'
        ? {
            onMouseDown: handleTouchStart,
            onMouseMove: handleTouchMove,
            onMouseUp: handleTouchEnd,
          }
        : {})}
    >
      {/* Visual Pull Indicator Banner */}
      {(pullDistance > 12 || isCurrentlyRefreshing) && (
        <View
          style={[
            styles.pullIndicatorContainer,
            { height: isCurrentlyRefreshing ? 60 : Math.max(pullDistance, 0) },
          ]}
        >
          <View style={styles.indicatorBadge}>
            {isCurrentlyRefreshing ? (
              <ActivityIndicator size="small" color="#0751A8" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons
                name={isTriggered ? 'arrow-up-circle' : 'water'}
                size={20}
                color={isTriggered ? '#16A34A' : '#0751A8'}
                style={{ marginRight: 8, transform: [{ rotate: isTriggered ? '180deg' : '0deg' }] }}
              />
            )}
            <Text style={[styles.indicatorText, isTriggered && { color: '#16A34A' }]}>
              {isCurrentlyRefreshing
                ? refreshMessage
                : isTriggered
                ? 'Release to refresh'
                : 'Pull down to refresh...'}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        ref={(node) => {
          internalScrollRef.current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        style={[styles.scrollView, style]}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleNativeScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={isCurrentlyRefreshing}
            onRefresh={handleRefresh}
            colors={['#0751A8']}
            tintColor="#0751A8"
            progressBackgroundColor="#FFFFFF"
          />
        }
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
});

export default PullToRefreshScrollView;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  pullIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F9',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE7F3',
  },
  indicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0751A8',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  indicatorText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
    color: '#0751A8',
  },
});
