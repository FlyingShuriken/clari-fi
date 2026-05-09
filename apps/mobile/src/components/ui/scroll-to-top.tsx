import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type RefObject, useCallback, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, type ScrollView } from 'react-native';
import { Colors, TouchTarget } from '../../theme';

interface ScrollToTopProps {
  scrollRef: RefObject<ScrollView | null>;
  visible: boolean;
}

export function ScrollToTop({ scrollRef, visible }: ScrollToTopProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  const prevVisible = useRef(visible);
  if (prevVisible.current !== visible) {
    prevVisible.current = visible;
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollRef]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          opacity,
          transform: [
            {
              scale: opacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={scrollToTop}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Scroll to top"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="arrow-up" size={20} color={Colors.green} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    zIndex: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  button: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: 22,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
