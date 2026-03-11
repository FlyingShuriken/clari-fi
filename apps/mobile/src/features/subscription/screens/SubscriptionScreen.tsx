import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { Colors } from '../../../theme';

type PlanChoice = 'FREE' | 'PREMIUM';

function formatPrice(value: number) {
  return `RM ${value.toFixed(2)}`;
}

export function SubscriptionScreen() {
  const controller = useClariFiController();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>(controller.subscription?.plan ?? 'PREMIUM');
  const [addonCount, setAddonCount] = useState(controller.subscription?.addonCount ?? 0);

  useEffect(() => {
    setSelectedPlan(controller.subscription?.plan ?? 'PREMIUM');
    setAddonCount(controller.subscription?.addonCount ?? 0);
  }, [controller.subscription?.addonCount, controller.subscription?.plan]);

  const preview = useMemo(() => {
    if (selectedPlan === 'FREE') {
      return {
        itemsPerSearch: 1,
        searchesPerMonth: 15,
        activeAlerts: 1,
        additionalMembers: 1,
        monthlyPriceRm: 0,
      };
    }

    return {
      itemsPerSearch: 10 + addonCount * 5,
      searchesPerMonth: 30 + addonCount * 30,
      activeAlerts: 5 + addonCount * 5,
      additionalMembers: 2 + addonCount,
      monthlyPriceRm: 5.99 + addonCount * 1.99,
    };
  }, [addonCount, selectedPlan]);

  const handleUnlock = async () => {
    await controller.updateSubscriptionPlan(selectedPlan, addonCount);
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons name="star-four-points-outline" size={14} color={Colors.green} />
          <Text style={styles.heroBadgeText}>Mock subscription</Text>
        </View>
        <Text style={styles.title}>Choose your ClariFi plan</Text>
        <Text style={styles.subtitle}>
          Unlock more compare capacity, more alerts, and larger family sharing without changing your core expense flow.
        </Text>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.successGlow,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] }),
            transform: [
              {
                scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.12] }),
              },
            ],
          },
        ]}
      />

      <View style={styles.planGrid}>
        {(['FREE', 'PREMIUM'] as const).map((plan) => {
          const active = selectedPlan === plan;
          const current = controller.subscription?.plan === plan;
          return (
            <TouchableOpacity
              key={plan}
              style={[styles.planCard, active && styles.planCardActive]}
              onPress={() => setSelectedPlan(plan)}
              activeOpacity={0.9}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan === 'FREE' ? 'Free' : 'Premium'}</Text>
                {current ? (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>Current</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.planPrice}>
                {plan === 'FREE' ? 'RM 0' : 'RM 5.99'}
                <Text style={styles.planPriceSuffix}> / month</Text>
              </Text>
              <Text style={styles.planCopy}>
                {plan === 'FREE'
                  ? 'Core capture and a light price-intelligence allowance.'
                  : 'Best for active shoppers and shared households.'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedPlan === 'PREMIUM' ? (
        <View style={styles.addonCard}>
          <View style={styles.addonHeader}>
            <View>
              <Text style={styles.sectionTitle}>Capacity add-ons</Text>
              <Text style={styles.sectionHint}>RM 1.99 each</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setAddonCount((count) => Math.max(0, count - 1))}
              >
                <MaterialCommunityIcons name="minus" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{addonCount}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setAddonCount((count) => Math.min(8, count + 1))}
              >
                <MaterialCommunityIcons name="plus" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.addonCopy}>
            Each add-on adds 5 more basket items, 30 more monthly compare searches, 5 more active alerts, and 1 more family member.
          </Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Your active limits</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Items per compare</Text>
          <Text style={styles.metricValue}>{preview.itemsPerSearch}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Monthly compare searches</Text>
          <Text style={styles.metricValue}>{preview.searchesPerMonth}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Active price alerts</Text>
          <Text style={styles.metricValue}>{preview.activeAlerts}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Additional family members</Text>
          <Text style={styles.metricValue}>{preview.additionalMembers}</Text>
        </View>
        <View style={[styles.metricRow, styles.metricRowTotal]}>
          <Text style={styles.metricLabel}>Preview total</Text>
          <Text style={styles.metricValueAccent}>
            {selectedPlan === 'FREE' ? 'RM 0.00' : formatPrice(preview.monthlyPriceRm)}
          </Text>
        </View>
      </View>

      {controller.subscription ? (
        <View style={styles.usageCard}>
          <Text style={styles.sectionTitle}>Current usage</Text>
          <Text style={styles.usageLine}>
            Compare searches: {controller.subscription.compare.usedThisMonth} / {controller.subscription.compare.searchesPerMonth}
          </Text>
          <Text style={styles.usageLine}>
            Active alerts: {controller.subscription.alerts.activeCount} / {controller.subscription.alerts.activeLimit}
          </Text>
          <Text style={styles.usageLine}>
            Family capacity: owner + {controller.subscription.family.additionalMembersAllowed}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.ctaBtn} onPress={handleUnlock} disabled={controller.loading}>
        <Text style={styles.ctaBtnText}>
          {selectedPlan === 'FREE' ? 'Use free plan' : 'Unlock premium mock'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  hero: {
    gap: 10,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.greenDim,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  successGlow: {
    position: 'absolute',
    top: 110,
    right: 24,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.green,
  },
  planGrid: {
    gap: 12,
  },
  planCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  planCardActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.surfaceHigh,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  currentPill: {
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  currentPillText: {
    color: Colors.green,
    fontSize: 11,
    fontWeight: '700',
  },
  planPrice: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  planPriceSuffix: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  planCopy: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  addonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  addonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  addonCopy: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRowTotal: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  metricValueAccent: {
    color: Colors.green,
    fontSize: 16,
    fontWeight: '700',
  },
  usageCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  usageLine: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  ctaBtn: {
    backgroundColor: Colors.green,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
});
