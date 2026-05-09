import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WeeklySlide } from '../../../shared/types';
import { Colors } from '../../../theme';

interface WeeklyStoryModalProps {
  visible: boolean;
  slides: WeeklySlide[];
  loading: boolean;
  onClose: () => void;
  onComparePrices?: () => void;
}

const SLIDE_DURATION = 7000;
const SWIPE_THRESHOLD = 40;

const SLIDE_BG: Record<WeeklySlide['type'], string> = {
  summary:   '#0F0F12',
  anomaly:   '#160B0A',
  education: '#0A0A18',
  tip:       '#0A140A',
  trend:     '#0C0F14',
  rank:      '#0D0D11',
  merchants: '#11090E',
  highlight: '#141008',
  forecast:  '#090C18',
};

const SLIDE_ACCENT_DEFAULT: Record<WeeklySlide['type'], string> = {
  summary:   Colors.textTertiary,
  anomaly:   Colors.coral,
  education: Colors.indigo,
  tip:       Colors.green,
  trend:     Colors.amber,
  rank:      Colors.indigo,
  merchants: '#EC4899',
  highlight: Colors.amber,
  forecast:  '#3B82F6',
};

const SLIDE_TYPE_LABEL: Record<WeeklySlide['type'], string> = {
  summary:   'WEEKLY WRAP',
  anomaly:   'PRICE ALERT',
  education: 'DID YOU KNOW',
  tip:       'SMART TIP',
  trend:     'SPENDING TREND',
  rank:      'WHERE IT WENT',
  merchants: 'TOP MERCHANTS',
  highlight: 'BIGGEST SPEND',
  forecast:  'MONTHLY OUTLOOK',
};

const SLIDE_TYPE_ICON: Record<WeeklySlide['type'], string> = {
  summary:   'chart-line',
  anomaly:   'alert-circle-outline',
  education: 'newspaper-variant-outline',
  tip:       'lightbulb-outline',
  trend:     'trending-up',
  rank:      'podium',
  merchants: 'store-outline',
  highlight: 'fire',
  forecast:  'calendar-month-outline',
};

function resolveAccent(slide: WeeklySlide | undefined): string {
  if (!slide) return Colors.green;
  if (slide.type === 'trend' && slide.delta) {
    if (slide.delta.direction === 'down') return Colors.green;
    if (slide.delta.direction === 'up') return Colors.coral;
    return Colors.amber;
  }
  return SLIDE_ACCENT_DEFAULT[slide.type];
}

export function WeeklyStoryModal({
  visible,
  slides,
  loading,
  onClose,
  onComparePrices,
}: WeeklyStoryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Stable animated values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(1)).current;

  // Mutable refs so callbacks inside closures always get latest values
  const currentIndexRef = useRef(0);
  const slidesRef       = useRef(slides);
  const onCloseRef      = useRef(onClose);
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Reset to slide 0 whenever the modal opens
  useEffect(() => {
    if (visible) {
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      fadeAnim.setValue(1);
    }
  }, [visible, fadeAnim]);

  // Drive progress animation + schedule auto-advance for each slide
  useEffect(() => {
    if (!visible || loading || slides.length === 0) return;

    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    const fillAnim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: SLIDE_DURATION,
      useNativeDriver: false,
    });
    fillAnim.start();

    const timer = setTimeout(() => {
      const curr  = currentIndexRef.current;
      const total = slidesRef.current.length;
      Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
        if (curr >= total - 1) {
          fadeAnim.setValue(1);
          onCloseRef.current();
        } else {
          currentIndexRef.current = curr + 1;
          setCurrentIndex(curr + 1);
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
      });
    }, SLIDE_DURATION);

    return () => {
      clearTimeout(timer);
      fillAnim.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, visible, loading, slides.length]);

  // Smooth transition to a given slide index
  const navigateTo = (nextIndex: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      if (nextIndex < 0 || nextIndex >= slidesRef.current.length) {
        fadeAnim.setValue(1);
        onCloseRef.current();
        return;
      }
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      Animated.timing(fadeAnim, { toValue: 1, duration: 190, useNativeDriver: true }).start();
    });
  };

  // Keep latest navigate handlers in refs so PanResponder never goes stale
  const goNextRef = useRef(() => navigateTo(currentIndexRef.current + 1));
  const goPrevRef = useRef(() => {
    if (currentIndexRef.current === 0) onCloseRef.current();
    else navigateTo(currentIndexRef.current - 1);
  });
  goNextRef.current = () => navigateTo(currentIndexRef.current + 1);
  goPrevRef.current = () => {
    if (currentIndexRef.current === 0) onCloseRef.current();
    else navigateTo(currentIndexRef.current - 1);
  };

  // Swipe-only PanResponder — taps fall through to the tap-zone TouchableOpacities below
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx, vx }) => {
        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > 0.4) {
          if (dx > 0) goPrevRef.current();
          else goNextRef.current();
        }
      },
    })
  ).current;

  const handleTapLeft  = () => goPrevRef.current();
  const handleTapRight = () => goNextRef.current();

  const slide  = slides[currentIndex];
  const bg     = slide ? SLIDE_BG[slide.type] : SLIDE_BG.summary;
  const accent = resolveAccent(slide);
  const hasBars = (slide?.bars?.length ?? 0) > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.root, { backgroundColor: bg }]}
        {...panResponder.panHandlers}
      >
        {/* ── Segmented progress bar ───────────────────────────────── */}
        <View style={styles.progressRow}>
          {slides.length > 0 ? (
            slides.map((_, i) => (
              <View key={i} style={styles.progressSegmentBg}>
                {i < currentIndex ? (
                  <View style={[styles.progressFill, { width: '100%', backgroundColor: accent }]} />
                ) : i === currentIndex ? (
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: accent,
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))
          ) : (
            <View style={[styles.progressSegmentBg, { flex: 1 }]} />
          )}
        </View>

        {/* ── Header: type badge + close ───────────────────────────── */}
        <View style={styles.headerRow}>
          {slide ? (
            <View style={styles.typeBadge}>
              <MaterialCommunityIcons
                name={SLIDE_TYPE_ICON[slide.type] as never}
                size={12}
                color={accent}
              />
              <Text style={[styles.typeBadgeText, { color: accent }]}>
                {SLIDE_TYPE_LABEL[slide.type]}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <MaterialCommunityIcons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Main content ─────────────────────────────────────────── */}
        {loading || slides.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.green} />
            <Text style={styles.loadingText}>Generating your weekly insights…</Text>
          </View>
        ) : (
          <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
            {/* Accent divider */}
            <View style={[styles.accentRule, { backgroundColor: accent }]} />

            {/* Emoji */}
            {slide?.emoji ? <Text style={styles.emoji}>{slide.emoji}</Text> : null}

            {/* Hero metric */}
            {slide?.metric ? (
              <Text style={[styles.metric, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
                {slide.metric}
              </Text>
            ) : null}

            {/* Subtitle */}
            {slide?.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>{slide.subtitle}</Text>
            ) : null}

            {/* Title */}
            <Text style={styles.title}>{slide?.title}</Text>

            {/* Body — suppressed on rank slides (bars take over) */}
            {hasBars ? null : (
              <Text style={styles.body}>{slide?.body}</Text>
            )}

            {/* ── Bar chart (rank slides) ──────────────────────────── */}
            {hasBars ? (
              <View style={styles.barsContainer}>
                {slide!.bars!.map((bar, i) => (
                  <View key={i} style={styles.barRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>{bar.label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          { width: `${bar.pct}%` as any, backgroundColor: bar.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.barAmt}>{bar.amtLabel}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ── Week-over-week comparison (trend slides) ─────────── */}
            {slide?.type === 'trend' && slide.delta ? (
              <View style={styles.trendCompareRow}>
                <View style={styles.trendBox}>
                  <Text style={styles.trendBoxLabel}>This week</Text>
                  <Text style={[styles.trendBoxValue, { color: accent }]}>{slide.metric ?? '—'}</Text>
                </View>
                <View style={[styles.trendDivider, { backgroundColor: accent + '40' }]} />
                <View style={styles.trendBox}>
                  <Text style={styles.trendBoxLabel}>vs last week</Text>
                  <Text style={styles.trendBoxValue}>
                    {slide.delta.direction === 'up'   ? '▲ more'
                    : slide.delta.direction === 'down' ? '▼ less'
                    : '≈ same'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── News / context block (education slides) ──────────── */}
            {slide?.newsContext ? (
              <View style={[styles.newsBlock, { borderLeftColor: accent + '70' }]}>
                <MaterialCommunityIcons name="newspaper-variant-outline" size={13} color={accent} />
                <Text style={styles.newsText}>{slide.newsContext}</Text>
              </View>
            ) : null}
          </Animated.View>
        )}

        {/* ── Slide counter ─────────────────────────────────────────── */}
        {slides.length > 0 ? (
          <Text style={styles.counter}>{currentIndex + 1} / {slides.length}</Text>
        ) : null}

        {/* ── Compare Prices CTA ────────────────────────────────────── */}
        {slide?.cta === 'compare_prices' && onComparePrices ? (
          <TouchableOpacity
            style={[
              styles.ctaButton,
              { borderColor: accent + '60', backgroundColor: accent + '1A' },
            ]}
            onPress={onComparePrices}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="tag-search-outline" size={16} color={accent} />
            <Text style={[styles.ctaText, { color: accent }]}>Compare Prices Nearby</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color={accent} />
          </TouchableOpacity>
        ) : null}

        {/* ── Tap zones (prev / next) ───────────────────────────────── */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <TouchableOpacity style={styles.tapLeft}  onPress={handleTapLeft}  activeOpacity={1} />
          <TouchableOpacity style={styles.tapRight} onPress={handleTapRight} activeOpacity={1} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── Progress bar ──────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressSegmentBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── Header ────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // ── Content ───────────────────────────────────────────────────────
  contentContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
    justifyContent: 'center',
  },
  accentRule: {
    width: 28,
    height: 2,
    borderRadius: 1,
    marginBottom: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  emoji: {
    fontSize: 52,
  },
  metric: {
    fontSize: 46,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: -6,
    lineHeight: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  body: {
    fontSize: 15,
    color: '#AEAEB2',
    lineHeight: 24,
  },

  // ── Bar chart ─────────────────────────────────────────────────────
  barsContainer: {
    gap: 12,
    marginTop: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 74,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textTertiary,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.surfaceHigh,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barAmt: {
    width: 66,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'right',
  },

  // ── Trend compare ─────────────────────────────────────────────────
  trendCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginTop: 4,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 14,
    padding: 16,
  },
  trendBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trendBoxLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  trendBoxValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: -0.3,
  },
  trendDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 4,
  },

  // ── News block ────────────────────────────────────────────────────
  newsBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderLeftWidth: 2,
    paddingLeft: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  newsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 19,
  },

  // ── Footer ────────────────────────────────────────────────────────
  counter: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    paddingBottom: 12,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 20,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Tap zones ────────────────────────────────────────────────────
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    top: 72,
    bottom: 108,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
});
