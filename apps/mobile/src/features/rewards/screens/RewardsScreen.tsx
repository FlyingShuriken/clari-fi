import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';
import { Colors } from '../../../theme';
import { LoadingRows } from '../../../components/ui/loading-state';
import { EmptyState } from '../../../components/ui/empty-state';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatRewardDate(value: string | null): string {
  if (!value) {
    return 'No accepted contributions yet';
  }

  const date = new Date(value);
  return date.toLocaleDateString('en-MY', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function rewardTypeLabel(type: string): string {
  switch (type) {
    case 'VOUCHER':
      return 'Voucher';
    case 'PARTNER_DISCOUNT':
      return 'Partner discount';
    case 'EXCLUSIVE_PROMOTION':
      return 'Exclusive promo';
    default:
      return type;
  }
}

function ledgerIcon(type: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (type) {
    case 'RECEIPT_ACCEPTED':
      return 'receipt-text-check-outline';
    case 'FLYER_ACCEPTED':
      return 'tag-heart-outline';
    case 'STREAK_BONUS':
      return 'fire';
    case 'REDEMPTION':
      return 'gift-outline';
    default:
      return 'star-outline';
  }
}

export function RewardsScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (controller.authSyncStatus !== 'ok' || controller.initialDataLoading) {
        return;
      }

      void Promise.all([
        controller.loadRewardSummary(),
        controller.loadRewardCatalog(),
        controller.loadRewardLedger(),
        controller.loadRewardRedemptions(),
      ]);
    }, [
      controller.authSyncStatus,
      controller.initialDataLoading,
      controller.loadRewardCatalog,
      controller.loadRewardLedger,
      controller.loadRewardRedemptions,
      controller.loadRewardSummary,
    ]),
  );

  const balance = controller.rewardSummary?.balance ?? 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.eyebrow}>Contribution economy</Text>
            <Text style={styles.title}>Earn rewards from trusted price data</Text>
            <Text style={styles.subtitle}>
              Receipts and flyers feed the price engine. Accepted uploads convert into points you can redeem.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              void Promise.all([
                controller.loadRewardSummary(),
                controller.loadRewardCatalog(),
                controller.loadRewardLedger(),
                controller.loadRewardRedemptions(),
              ]);
            }}
            testID={TEST_IDS.rewards.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh rewards"
            accessibilityState={{ busy: controller.loading || controller.initialDataLoading }}
          >
            {controller.loading || controller.initialDataLoading ? (
              <ActivityIndicator size="small" color={Colors.green} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={18} color={Colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroBalanceLabel}>Current balance</Text>
              <Text style={styles.heroBalanceValue}>{balance} pts</Text>
            </View>
            <TouchableOpacity
              style={styles.upgradeChip}
              onPress={() => navigation.navigate('Subscription')}
              accessibilityRole="button"
              accessibilityLabel="Open premium plan to increase reward capacity"
            >
              <MaterialCommunityIcons name="crown-outline" size={16} color={Colors.amber} />
              <Text style={styles.upgradeChipText}>Increase capacity</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{controller.rewardSummary?.currentStreakDays ?? 0} days</Text>
              <Text style={styles.metricLabel}>Current streak</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {formatRewardDate(controller.rewardSummary?.lastAcceptedAt ?? null)}
              </Text>
              <Text style={styles.metricLabel}>Last accepted contribution</Text>
            </View>
          </View>
        </View>

        <View style={styles.loopCard}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.loopSteps}>
            <View style={styles.loopStep}>
              <View style={[styles.loopBadge, { backgroundColor: '#F970661F' }]}>
                <Text style={[styles.loopBadgeText, { color: '#F97066' }]}>1</Text>
              </View>
              <Text style={styles.loopTitle}>Contribute Data</Text>
              <Text style={styles.loopCopy}>Upload receipts or flyers with product prices.</Text>
            </View>
            <View style={styles.loopStep}>
              <View style={[styles.loopBadge, { backgroundColor: '#FDB0221F' }]}>
                <Text style={[styles.loopBadgeText, { color: Colors.amber }]}>2</Text>
              </View>
              <Text style={styles.loopTitle}>Earn Points</Text>
              <Text style={styles.loopCopy}>Accepted receipt +8, flyer +10, plus streak bonuses.</Text>
            </View>
            <View style={styles.loopStep}>
              <View style={[styles.loopBadge, { backgroundColor: '#56D9F11F' }]}>
                <Text style={[styles.loopBadgeText, { color: '#56D9F1' }]}>3</Text>
              </View>
              <Text style={styles.loopTitle}>Redeem Rewards</Text>
              <Text style={styles.loopCopy}>Trade points for mock vouchers and partner perks.</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rewards catalog</Text>
            <Text style={styles.sectionCaption}>{controller.rewardCatalog.length} active</Text>
          </View>
          {controller.initialDataLoading && controller.rewardCatalog.length === 0 ? (
            <LoadingRows label="Syncing rewards" count={3} />
          ) : controller.rewardCatalog.length === 0 ? (
            <Text style={styles.emptyText}>Reward catalog will appear automatically after sync.</Text>
          ) : (
            controller.rewardCatalog.map((reward, index) => {
              const affordable = balance >= reward.pointsCost;
              return (
                <View
                  key={reward.id}
                  style={[
                    styles.rewardCard,
                    index === 0 && styles.rewardCardFeatured,
                    !affordable && styles.rewardCardDisabled,
                  ]}
                >
                  <View style={styles.rewardCardTop}>
                    <View style={styles.rewardTypeChip}>
                      <Text style={styles.rewardTypeChipText}>{rewardTypeLabel(reward.type)}</Text>
                    </View>
                    <Text style={styles.rewardCost}>{reward.pointsCost} pts</Text>
                  </View>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={styles.rewardDescription}>
                    {reward.description ?? 'Redeem this mock reward from your balance.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.redeemButton, !affordable && styles.redeemButtonDisabled]}
                    onPress={() => {
                      void controller.redeemRewardById(reward.id);
                    }}
                    disabled={!affordable || controller.loading}
                    testID={index === 0 ? TEST_IDS.rewards.redeemPrimaryButton : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={affordable ? `Redeem ${reward.title}` : `${reward.title} needs ${reward.pointsCost - balance} more points`}
                    accessibilityState={{ disabled: !affordable || controller.loading }}
                  >
                    <Text style={[styles.redeemButtonText, !affordable && styles.redeemButtonTextDisabled]}>
                      {affordable ? 'Redeem reward' : `Need ${reward.pointsCost - balance} more pts`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent points activity</Text>
            <Text style={styles.sectionCaption}>{controller.rewardLedger.length} entries</Text>
          </View>
          {controller.initialDataLoading && controller.rewardLedger.length === 0 ? (
            <LoadingRows label="Syncing activity" count={3} />
          ) : controller.rewardLedger.length === 0 ? (
            <EmptyState
              icon="receipt-text-plus-outline"
              title="No points activity yet"
              message="Upload a receipt or flyer from Capture to earn your first points."
            />
          ) : (
            controller.rewardLedger.map((entry) => (
              <View key={entry.id} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <MaterialCommunityIcons
                    name={ledgerIcon(entry.type)}
                    size={16}
                    color={entry.pointsDelta >= 0 ? Colors.green : Colors.coral}
                  />
                </View>
                <View style={styles.activityBody}>
                  <Text style={styles.activityTitle}>
                    {entry.description ?? entry.type.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.activityMeta}>{formatRewardDate(entry.createdAt)}</Text>
                </View>
                <Text style={[styles.activityDelta, entry.pointsDelta < 0 && styles.activityDeltaNegative]}>
                  {entry.pointsDelta > 0 ? `+${entry.pointsDelta}` : entry.pointsDelta} pts
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Redemption history</Text>
            <Text style={styles.sectionCaption}>{controller.rewardRedemptions.length} redemptions</Text>
          </View>
          {controller.initialDataLoading && controller.rewardRedemptions.length === 0 ? (
            <LoadingRows label="Syncing redemptions" count={2} />
          ) : controller.rewardRedemptions.length === 0 ? (
            <EmptyState
              icon="gift-outline"
              title="No redemptions yet"
              message="Rewards you redeem will appear here with their history."
            />
          ) : (
            controller.rewardRedemptions.map((item) => (
              <View key={item.id} style={styles.redemptionRow}>
                <View>
                  <Text style={styles.redemptionTitle}>{item.rewardTitle}</Text>
                  <Text style={styles.redemptionMeta}>
                    {rewardTypeLabel(item.rewardType)} · {formatRewardDate(item.createdAt)}
                  </Text>
                </View>
                <View style={styles.redemptionRight}>
                  <Text style={styles.redemptionCost}>-{item.pointsCost} pts</Text>
                  <Text style={styles.redemptionStatus}>{item.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerTextBlock: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: Colors.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#FDB02230',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBalanceLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroBalanceValue: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  upgradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDB02218',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  upgradeChipText: {
    color: Colors.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  loopCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  loopSteps: {
    gap: 12,
  },
  loopStep: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  loopBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  loopTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  loopCopy: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCaption: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  rewardCard: {
    backgroundColor: Colors.bg,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rewardCardFeatured: {
    borderColor: '#FDB02250',
  },
  rewardCardDisabled: {
    opacity: 0.72,
  },
  rewardCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardTypeChip: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rewardTypeChipText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  rewardCost: {
    color: Colors.amber,
    fontSize: 15,
    fontWeight: '800',
  },
  rewardTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  rewardDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  redeemButton: {
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  redeemButtonDisabled: {
    backgroundColor: Colors.surfaceHigh,
  },
  redeemButtonText: {
    color: Colors.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  redeemButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  activityMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  activityDelta: {
    color: Colors.green,
    fontSize: 13,
    fontWeight: '800',
  },
  activityDeltaNegative: {
    color: Colors.coral,
  },
  redemptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  redemptionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  redemptionMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  redemptionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  redemptionCost: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  redemptionStatus: {
    color: Colors.green,
    fontSize: 11,
    fontWeight: '700',
  },
});
