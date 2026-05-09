import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { Colors } from '../../../theme';
import { InlineSpinner } from '../../../components/ui/loading-state';

type PlanChoice = 'FREE' | 'PREMIUM';

const FREE_FEATURES = [
  'STT & OCR capture',
  'Full ledger & overview',
  '1 item per search',
  '15 searches / month',
  '1 price alert',
  '1 extra family member',
];

const PREMIUM_FEATURES = [
  'Everything in Free',
  '10 items per search',
  '30 searches / month',
  '5 active price alerts',
  '2 extra family members',
];

export function SubscriptionScreen() {
  const controller = useClariFiController();
  const insets = useSafeAreaInsets();
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const crownScale = useRef(new Animated.Value(1)).current;

  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>(
    controller.subscription?.plan ?? 'PREMIUM',
  );
  const [addonCount, setAddonCount] = useState(controller.subscription?.addonCount ?? 0);

  useEffect(() => {
    setSelectedPlan(controller.subscription?.plan ?? 'PREMIUM');
    setAddonCount(controller.subscription?.addonCount ?? 0);
  }, [controller.subscription?.addonCount, controller.subscription?.plan]);

  // Gentle crown pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(crownScale, {
          toValue: 1.07,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(crownScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [crownScale]);

  const preview = useMemo(() => {
    if (selectedPlan === 'FREE') {
      return { itemsPerSearch: 1, searchesPerMonth: 15, activeAlerts: 1, additionalMembers: 1, monthlyPriceRm: 0 };
    }
    return {
      itemsPerSearch: 10 + addonCount * 5,
      searchesPerMonth: 30 + addonCount * 30,
      activeAlerts: 5 + addonCount * 5,
      additionalMembers: 2 + addonCount,
      monthlyPriceRm: 5.99 + addonCount * 1.99,
    };
  }, [addonCount, selectedPlan]);

  const isCurrentPlan =
    controller.subscription?.plan === selectedPlan &&
    (selectedPlan === 'FREE' || controller.subscription?.addonCount === addonCount);

  const handleUnlock = async () => {
    await controller.updateSubscriptionPlan(selectedPlan, addonCount);
    // Unlock burst animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 200, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.6, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.timing(crownScale, { toValue: 1.35, duration: 180, useNativeDriver: true }),
      Animated.spring(crownScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      {/* Unlock glow burst */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glowBurst, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top > 0 ? 8 : 16 }]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Animated.View style={[styles.crownBadge, { transform: [{ scale: crownScale }] }]}>
            <MaterialCommunityIcons name="crown" size={30} color="#fff" />
          </Animated.View>
          <Text style={styles.heroTitle}>ClariFi Premium</Text>
          <Text style={styles.heroSub}>Unlock more capacity, smarter price tracking{'\n'}and expanded family sharing</Text>
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <MaterialCommunityIcons key={i} name="star" size={14} color={Colors.amber} />
            ))}
          </View>
        </View>
        {controller.initialDataLoading && !controller.subscription ? (
          <InlineSpinner label="Syncing current plan" />
        ) : null}

        {/* Plan toggle */}
        <View style={styles.planToggle}>
          {(['FREE', 'PREMIUM'] as const).map((plan) => {
            const active = selectedPlan === plan;
            const isCurrent = controller.subscription?.plan === plan;
            return (
              <TouchableOpacity
                key={plan}
                style={[styles.planToggleBtn, active && styles.planToggleBtnActive]}
                onPress={() => setSelectedPlan(plan)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${plan === 'FREE' ? 'Free' : 'Premium'} plan${isCurrent ? ', current plan' : ''}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.planToggleText, active && styles.planToggleTextActive]}>
                  {plan === 'FREE' ? 'Free' : 'Premium'}
                </Text>
                {isCurrent ? <Text style={styles.planToggleCurrent}> · Current</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected plan card */}
        <View style={styles.planCardFull}>
          {/* Badge row */}
          <View style={styles.planBadgeRow}>
            <View style={[styles.planBadge, selectedPlan === 'PREMIUM' && styles.planBadgePremium]}>
              <Text style={[styles.planBadgeText, selectedPlan === 'PREMIUM' && styles.planBadgeTextPremium]}>
                {controller.subscription?.plan === selectedPlan ? 'CURRENT' : selectedPlan === 'PREMIUM' ? 'POPULAR' : 'FREE'}
              </Text>
            </View>
          </View>

          <Text style={[styles.planName, selectedPlan === 'PREMIUM' && styles.planNamePremium]}>
            {selectedPlan === 'FREE' ? 'Free' : 'Premium'}
          </Text>

          <View style={styles.priceRow}>
            <Text style={[styles.priceAmt, selectedPlan === 'PREMIUM' && styles.priceAmtPremium]}>
              {selectedPlan === 'FREE' ? 'RM 0' : 'RM 5.99'}
            </Text>
            <Text style={styles.pricePer}>/mo</Text>
          </View>

          <View style={styles.cardDivider} />

          {(selectedPlan === 'FREE' ? FREE_FEATURES : PREMIUM_FEATURES).map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <MaterialCommunityIcons
                name="check"
                size={10}
                color={selectedPlan === 'PREMIUM' && i === PREMIUM_FEATURES.length - 1 ? Colors.amber : Colors.green}
              />
              <Text
                style={[
                  styles.featureText,
                  selectedPlan === 'PREMIUM' && i === PREMIUM_FEATURES.length - 1 && styles.featureTextAmber,
                ]}
              >
                {f}
              </Text>
            </View>
          ))}

          {selectedPlan === 'PREMIUM' && (
            <View style={styles.addonHint}>
              <MaterialCommunityIcons name="lightning-bolt" size={10} color={Colors.amber} />
              <Text style={styles.addonHintText}>Add-on packs available</Text>
            </View>
          )}
        </View>

        {/* Add-on packs */}
        {selectedPlan === 'PREMIUM' && (
          <View style={styles.addonCard}>
            <View style={styles.addonTop}>
              <View>
                <Text style={styles.addonTitle}>Add-on Pack</Text>
                <Text style={styles.addonPrice}>RM 1.99 / pack / month</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setAddonCount((n) => Math.max(0, n - 1))}
                  disabled={addonCount === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Remove one add-on pack"
                  accessibilityState={{ disabled: addonCount === 0 }}
                >
                  <MaterialCommunityIcons name="minus" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{addonCount}</Text>
                <TouchableOpacity
                  style={styles.stepperBtnGreen}
                  onPress={() => setAddonCount((n) => Math.min(8, n + 1))}
                  disabled={addonCount >= 8}
                  accessibilityRole="button"
                  accessibilityLabel="Add one add-on pack"
                  accessibilityState={{ disabled: addonCount >= 8 }}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={Colors.green} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.addonDivider} />

            <View style={styles.addonBenefitRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={12} color={Colors.amber} />
              <Text style={styles.addonBenefitText}>+5 items/search · +30 searches/month</Text>
            </View>
            <View style={styles.addonBenefitRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={12} color={Colors.amber} />
              <Text style={styles.addonBenefitText}>+5 active alerts · +1 family member</Text>
            </View>

            {addonCount > 0 && (
              <View style={styles.addonSummary}>
                <Text style={styles.addonSumLabel}>
                  {addonCount} pack{addonCount > 1 ? 's' : ''} selected
                </Text>
                <Text style={styles.addonSumPrice}>= RM {preview.monthlyPriceRm.toFixed(2)}/mo</Text>
              </View>
            )}
          </View>
        )}

        {/* Limits preview */}
        <View style={styles.limitsCard}>
          <Text style={styles.sectionTitle}>Your limits with this plan</Text>
          {[
            { label: 'Items per compare', value: String(preview.itemsPerSearch) },
            { label: 'Monthly searches', value: String(preview.searchesPerMonth) },
            { label: 'Active price alerts', value: String(preview.activeAlerts) },
            { label: 'Extra family members', value: String(preview.additionalMembers) },
          ].map((row) => (
            <View key={row.label} style={styles.limitRow}>
              <Text style={styles.limitLabel}>{row.label}</Text>
              <Text style={styles.limitVal}>{row.value}</Text>
            </View>
          ))}
          <View style={styles.limitRowTotal}>
            <Text style={styles.limitLabel}>Monthly total</Text>
            <Text style={styles.limitValAccent}>
              {selectedPlan === 'FREE' ? 'RM 0.00' : `RM ${preview.monthlyPriceRm.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Current usage */}
        {controller.subscription && (
          <View style={styles.usageCard}>
            <Text style={styles.sectionTitle}>This month's usage</Text>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Compare searches</Text>
              <Text style={styles.limitVal}>
                {controller.subscription.compare.usedThisMonth} / {controller.subscription.compare.searchesPerMonth}
              </Text>
            </View>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Active alerts</Text>
              <Text style={styles.limitVal}>
                {controller.subscription.alerts.activeCount} / {controller.subscription.alerts.activeLimit}
              </Text>
            </View>
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Family capacity</Text>
              <Text style={styles.limitVal}>owner + {controller.subscription.family.additionalMembersAllowed}</Text>
            </View>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, isCurrentPlan && styles.ctaBtnDisabled]}
          onPress={handleUnlock}
          disabled={controller.loading || isCurrentPlan}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={isCurrentPlan ? 'This is your current plan' : selectedPlan === 'FREE' ? 'Switch to Free plan' : `Unlock Premium for RM ${preview.monthlyPriceRm.toFixed(2)} per month`}
          accessibilityState={{ disabled: controller.loading || isCurrentPlan }}
        >
          <MaterialCommunityIcons
            name="crown"
            size={18}
            color={isCurrentPlan ? Colors.textSecondary : Colors.bg}
          />
          <Text style={[styles.ctaBtnText, isCurrentPlan && styles.ctaBtnTextDisabled]}>
            {isCurrentPlan
              ? 'This is your current plan'
              : selectedPlan === 'FREE'
              ? 'Switch to Free'
              : `Unlock Premium · RM ${preview.monthlyPriceRm.toFixed(2)}/mo`}
          </Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          Cancel anytime · Auto-renews monthly · Mock payment only
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  glowBurst: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.green,
    zIndex: 0,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 14,
  },

  // Hero
  hero: {
    backgroundColor: '#0A0A18',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1040',
  },
  crownBadge: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: '#1A0A3E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'Georgia',
    letterSpacing: 0,
  },
  heroSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
  },

  // Plan cards
  planToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  planToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planToggleBtnActive: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.green,
  },
  planToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  planToggleTextActive: {
    color: Colors.green,
  },
  planToggleCurrent: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  planCardFull: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planCardFreeActive: {
    borderColor: Colors.textSecondary,
  },
  planCardPremiumActive: {
    backgroundColor: '#091610',
    borderColor: Colors.green,
  },
  planBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planBadge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planBadgePremium: {
    backgroundColor: Colors.greenDim,
  },
  planBadgeText: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planBadgeTextPremium: {
    color: Colors.green,
  },
  planName: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  planNamePremium: {
    color: Colors.green,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceAmt: {
    color: Colors.textPrimary,
    fontSize: 21,
    fontWeight: '700',
  },
  priceAmtPremium: {
    color: Colors.green,
  },
  pricePer: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  featureText: {
    color: Colors.textSecondary,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  featureTextAmber: {
    color: Colors.amber,
  },
  addonHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  addonHintText: {
    color: Colors.amber,
    fontSize: 11,
    fontWeight: '500',
  },

  // Add-on card
  addonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: `${Colors.amber}50`,
  },
  addonTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addonTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  addonPrice: {
    color: Colors.amber,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnGreen: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  addonDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  addonBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addonBenefitText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  addonSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `${Colors.amber}14`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  addonSumLabel: {
    color: Colors.amber,
    fontSize: 13,
    fontWeight: '500',
  },
  addonSumPrice: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Limits + Usage
  limitsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  usageCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    marginTop: 2,
  },
  limitLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  limitVal: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  limitValAccent: {
    color: Colors.green,
    fontSize: 15,
    fontWeight: '700',
  },

  // CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    borderRadius: 99,
    height: 56,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaBtnTextDisabled: {
    color: Colors.textSecondary,
  },
  terms: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
});
