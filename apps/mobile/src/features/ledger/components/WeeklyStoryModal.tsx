import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
}

const SLIDE_BG: Record<WeeklySlide['type'], string> = {
  summary: Colors.surface,
  anomaly: Colors.coralDim,
  education: Colors.indigoDim,
  tip: Colors.greenDim,
};

const SLIDE_ACCENT: Record<WeeklySlide['type'], string> = {
  summary: Colors.textSecondary,
  anomaly: '#E85A4F',
  education: Colors.indigo,
  tip: Colors.green,
};

export function WeeklyStoryModal({ visible, slides, loading, onClose }: WeeklyStoryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleTapLeft = () => {
    if (currentIndex === 0) {
      onClose();
    } else {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleTapRight = () => {
    if (currentIndex >= slides.length - 1) {
      onClose();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const slide = slides[currentIndex];
  const bg = slide ? SLIDE_BG[slide.type] : Colors.surface;
  const accent = slide ? SLIDE_ACCENT[slide.type] : Colors.green;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
        {/* Progress bar */}
        <View style={styles.progressRow}>
          {slides.length > 0
            ? slides.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    { backgroundColor: i <= currentIndex ? accent : Colors.surfaceHigh },
                  ]}
                />
              ))
            : <View style={[styles.progressSegment, { backgroundColor: Colors.surfaceHigh, flex: 1 }]} />}
        </View>

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Content */}
        {loading || slides.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.green} />
            <Text style={styles.loadingText}>Generating your weekly insights…</Text>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {slide?.emoji ? <Text style={styles.emoji}>{slide.emoji}</Text> : null}
            {slide?.metric ? <Text style={[styles.metric, { color: accent }]}>{slide.metric}</Text> : null}
            {slide?.subtitle ? <Text style={styles.subtitle}>{slide.subtitle}</Text> : null}
            <Text style={styles.title}>{slide?.title}</Text>
            <Text style={styles.body}>{slide?.body}</Text>
          </View>
        )}

        {/* Counter */}
        {slides.length > 0 && (
          <Text style={styles.counter}>{currentIndex + 1} / {slides.length}</Text>
        )}

        {/* Tap zones */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <TouchableOpacity style={styles.tapLeft} onPress={handleTapLeft} activeOpacity={1} />
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
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 16,
    marginTop: 4,
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
  contentContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 12,
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  metric: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -4,
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
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  counter: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    paddingBottom: 24,
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    top: 80,
    bottom: 60,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
});
