import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { useClariFiController } from '../../core/state/clariFi-controller';
import { Colors, Shadows } from '../../theme';

const BTN_SIZE = 44;
const OPTION_SIZE = 44;
const FAN_DISTANCE_X = 64;
const FAN_DISTANCE_Y = 72;
const SWIPE_THRESHOLD = 20;
const LONG_PRESS_MS = 150;
const VERTICAL_THRESHOLD = -30;

type Selection = 'none' | 'voice' | 'photo' | 'gallery';

export function QuickCaptureButton() {
  const controller = useClariFiController();

  const activeScale = useRef(new Animated.Value(1)).current;
  const leftOpacity = useRef(new Animated.Value(0)).current;
  const rightOpacity = useRef(new Animated.Value(0)).current;
  const leftScale = useRef(new Animated.Value(0)).current;
  const rightScale = useRef(new Animated.Value(0)).current;
  const leftGlow = useRef(new Animated.Value(0)).current;
  const rightGlow = useRef(new Animated.Value(0)).current;
  const topOpacity = useRef(new Animated.Value(0)).current;
  const topScale = useRef(new Animated.Value(0)).current;
  const topGlow = useRef(new Animated.Value(0)).current;

  const selection = useRef<Selection>('none');
  const isActive = useRef(false);

  const expand = useCallback(() => {
    isActive.current = true;
    selection.current = 'none';

    Animated.spring(activeScale, {
      toValue: 0.9,
      useNativeDriver: true,
      bounciness: 8,
      speed: 20,
    }).start();

    Animated.stagger(40, [
      Animated.parallel([
        Animated.spring(leftScale, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 20 }),
        Animated.spring(leftOpacity, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 24 }),
      ]),
      Animated.parallel([
        Animated.spring(topScale, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 20 }),
        Animated.spring(topOpacity, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 24 }),
      ]),
      Animated.parallel([
        Animated.spring(rightScale, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 20 }),
        Animated.spring(rightOpacity, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 24 }),
      ]),
    ]).start();
  }, [activeScale, leftScale, leftOpacity, topScale, topOpacity, rightScale, rightOpacity]);

  const collapse = useCallback(() => {
    isActive.current = false;
    selection.current = 'none';

    Animated.parallel([
      Animated.spring(activeScale, { toValue: 1, useNativeDriver: true, bounciness: 10, speed: 22 }),
      Animated.timing(leftOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(rightOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(topOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(leftScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(rightScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(topScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(leftGlow, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(rightGlow, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(topGlow, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [activeScale, leftScale, leftOpacity, rightScale, rightOpacity, topScale, topOpacity, leftGlow, rightGlow, topGlow]);

  const triggerAction = useCallback(
    (sel: Selection) => {
      if (sel === 'voice') {
        controller.startListening();
      } else if (sel === 'photo') {
        controller.pickDocumentCamera();
      } else if (sel === 'gallery') {
        controller.pickDocumentGallery();
      }
    },
    [controller],
  );

  const panGesture = useRef(
    Gesture.Pan()
      .minDistance(5)
      .onUpdate((e) => {
        if (!isActive.current) return;
        const dx = e.translationX;
        const dy = e.translationY;

        const resetLeft = () => {
          Animated.spring(leftScale, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          Animated.spring(leftGlow, { toValue: 0, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
        };
        const resetRight = () => {
          Animated.spring(rightScale, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          Animated.spring(rightGlow, { toValue: 0, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
        };
        const resetTop = () => {
          Animated.spring(topScale, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          Animated.spring(topGlow, { toValue: 0, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
        };

        if (dy < VERTICAL_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
          selection.current = 'gallery';
          Animated.spring(topScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          Animated.spring(topGlow, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          resetLeft();
          resetRight();
        } else if (dx < -SWIPE_THRESHOLD) {
          selection.current = 'voice';
          Animated.spring(leftScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          Animated.spring(leftGlow, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          resetRight();
          resetTop();
        } else if (dx > SWIPE_THRESHOLD) {
          selection.current = 'photo';
          Animated.spring(rightScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          Animated.spring(rightGlow, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 20 }).start();
          resetLeft();
          resetTop();
        } else {
          selection.current = 'none';
          resetLeft();
          resetRight();
          resetTop();
        }
      })
      .onEnd(() => {
        const sel = selection.current;
        if (sel !== 'none') {
          triggerAction(sel);
        }
        collapse();
      }),
  ).current;

  const longPressGesture = useRef(
    Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .onStart(() => {
        expand();
      })
      .onFinalize(() => {}),
  ).current;

  const composed = Gesture.Simultaneous(longPressGesture, panGesture);

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container}>
        {/* Voice (left) */}
        <Animated.View
          style={[
            styles.optionBase,
            styles.optionLeft,
            {
              opacity: leftOpacity,
              transform: [
                { scale: leftScale },
                { translateX: -FAN_DISTANCE_X },
                { translateY: -FAN_DISTANCE_Y + 10 },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.optionCircle,
              styles.voiceCircle,
              {
                transform: [{ scale: leftGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
                shadowRadius: leftGlow.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }),
                shadowOpacity: leftGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
              },
            ]}
          >
            <MaterialCommunityIcons name="microphone" size={20} color="#fff" />
          </Animated.View>
        </Animated.View>

        {/* Gallery (up) */}
        <Animated.View
          style={[
            styles.optionBase,
            styles.optionTop,
            {
              opacity: topOpacity,
              transform: [
                { scale: topScale },
                { translateY: -FAN_DISTANCE_Y - 6 },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.optionCircle,
              styles.galleryCircle,
              {
                transform: [{ scale: topGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
                shadowRadius: topGlow.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }),
                shadowOpacity: topGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
              },
            ]}
          >
            <MaterialCommunityIcons name="image-multiple" size={20} color="#fff" />
          </Animated.View>
        </Animated.View>

        {/* Photo (right) */}
        <Animated.View
          style={[
            styles.optionBase,
            styles.optionRight,
            {
              opacity: rightOpacity,
              transform: [
                { scale: rightScale },
                { translateX: FAN_DISTANCE_X },
                { translateY: -FAN_DISTANCE_Y + 10 },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.optionCircle,
              styles.photoCircle,
              {
                transform: [{ scale: rightGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
                shadowRadius: rightGlow.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }),
                shadowOpacity: rightGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] }),
              },
            ]}
          >
            <MaterialCommunityIcons name="camera" size={20} color="#fff" />
          </Animated.View>
        </Animated.View>

        {/* Center plus */}
        <Animated.View style={[styles.mainButton, { transform: [{ scale: activeScale }] }]}>
          <MaterialCommunityIcons name="plus" size={26} color="#fff" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButton: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
    elevation: 6,
  },
  optionBase: {
    position: 'absolute',
    width: OPTION_SIZE,
    height: OPTION_SIZE,
  },
  optionLeft: {
    left: (BTN_SIZE - OPTION_SIZE) / 2,
    top: (BTN_SIZE - OPTION_SIZE) / 2,
  },
  optionRight: {
    left: (BTN_SIZE - OPTION_SIZE) / 2,
    top: (BTN_SIZE - OPTION_SIZE) / 2,
  },
  optionTop: {
    left: (BTN_SIZE - OPTION_SIZE) / 2,
    top: (BTN_SIZE - OPTION_SIZE) / 2,
  },
  optionCircle: {
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    borderRadius: OPTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    shadowOpacity: 0.3,
    elevation: 6,
  },
  voiceCircle: {
    backgroundColor: Colors.coral,
  },
  photoCircle: {
    backgroundColor: Colors.indigo,
  },
  galleryCircle: {
    backgroundColor: Colors.amber,
  },
});
