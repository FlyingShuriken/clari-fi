import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme';

const THRESHOLD = 70;

interface RefreshScrollProps extends ScrollViewProps {
  onRefreshAsync: () => Promise<void>;
}

export function RefreshScroll({
  onRefreshAsync,
  children,
  contentContainerStyle,
  ...rest
}: RefreshScrollProps) {
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pastThreshold = useRef(false);
  const [pulled, setPulled] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefreshAsync();
    setRefreshing(false);
    setPulled(false);
  }, [onRefreshAsync]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollY.setValue(y);
      const nowPast = y < -THRESHOLD;
      if (nowPast !== pastThreshold.current) {
        pastThreshold.current = nowPast;
        setPulled(nowPast);
      }
    },
    [scrollY],
  );

  const arrowRotate = scrollY.interpolate({
    inputRange: [-THRESHOLD, -THRESHOLD * 0.3, 0],
    outputRange: ['180deg', '0deg', '0deg'],
    extrapolate: 'clamp',
  });

  const indicatorOpacity = scrollY.interpolate({
    inputRange: [-THRESHOLD * 0.3, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const indicatorScale = scrollY.interpolate({
    inputRange: [-THRESHOLD, -THRESHOLD * 0.5, 0],
    outputRange: [1, 0.8, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      {/* Animated pull indicator above scroll */}
      <Animated.View
        style={[
          styles.indicator,
          {
            opacity: indicatorOpacity,
            transform: [{ scale: indicatorScale }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
          <MaterialCommunityIcons
            name={refreshing ? 'loading' : 'arrow-down'}
            size={16}
            color={pulled ? Colors.green : Colors.textSecondary}
          />
        </Animated.View>
        <Text style={[styles.indicatorText, pulled && styles.indicatorTextActive]}>
          {refreshing ? 'Refreshing...' : pulled ? 'Release to refresh' : 'Pull to refresh'}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        {...rest}
        contentContainerStyle={contentContainerStyle}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  indicator: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  indicatorTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
});
