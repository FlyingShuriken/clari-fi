import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { DarkCard } from '../../../components/ui/dark-card';
import { LoadingRows } from '../../../components/ui/loading-state';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';

type WizardStep = 1 | 2 | 3;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Choose expense',
  2: "Who's splitting?",
  3: 'Assign items',
};

function toNumber(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

const inputTheme = {
  colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary },
};

export function SplitsScreen() {
  const controller = useClariFiController();
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [selectedFamilyMemberIds, setSelectedFamilyMemberIds] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [guestParticipants, setGuestParticipants] = useState<string[]>([]);
  const [sharedChargeInput, setSharedChargeInput] = useState('0');
  const [assignmentsByLineItemId, setAssignmentsByLineItemId] = useState<Record<string, string[]>>({});
  const [showReview, setShowReview] = useState(false);

  const activeFamily = useMemo(
    () => controller.families.find((f) => f.id === controller.activeFamilyId) ?? null,
    [controller.activeFamilyId, controller.families],
  );
  const splitDetail = controller.splitDetail;
  const splitParticipants = splitDetail?.participants ?? [];
  const splitLineItems = splitDetail?.expenseLineItems ?? [];

  useEffect(() => {
    setStep(1);
    setSelectedExpenseId('');
    setSelectedFamilyMemberIds([]);
    setGuestInput('');
    setGuestParticipants([]);
    setSharedChargeInput('0');
    setAssignmentsByLineItemId({});
    setShowReview(false);
  }, [controller.activeFamilyId]);

  useEffect(() => {
    if (!splitDetail || splitLineItems.length === 0 || splitParticipants.length === 0) return;
    setAssignmentsByLineItemId((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const lineItem of splitLineItems) {
        if ((next[lineItem.id] ?? []).length === 0) {
          next[lineItem.id] = splitParticipants.map((p) => p.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [splitDetail?.split.id, splitLineItems, splitParticipants]);

  const toggleFamilyMember = (id: string) => {
    setSelectedFamilyMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addGuest = () => {
    const t = guestInput.trim();
    if (!t || guestParticipants.includes(t)) return;
    setGuestParticipants((prev) => [...prev, t]);
    setGuestInput('');
  };

  const toggleAssignment = (lineItemId: string, participantId: string) => {
    setAssignmentsByLineItemId((prev) => {
      const cur = prev[lineItemId] ?? [];
      return {
        ...prev,
        [lineItemId]: cur.includes(participantId)
          ? cur.filter((x) => x !== participantId)
          : [...cur, participantId],
      };
    });
  };

  const createDraft = async () => {
    if (!controller.activeFamilyId) return;
    await controller.createSplitDraft({
      familyId: controller.activeFamilyId,
      expenseId: selectedExpenseId || undefined,
      sharedCharge: toNumber(sharedChargeInput),
      participantFamilyMemberIds: selectedFamilyMemberIds,
      guestParticipants,
    });
    setStep(3);
  };

  const saveAllocations = async () => {
    if (!controller.activeSplitId || !splitDetail || splitLineItems.length === 0) return;
    const lineAssignments = splitLineItems.map((li) => ({
      expenseLineItemId: li.id,
      participantIds: assignmentsByLineItemId[li.id] ?? [],
    }));
    await controller.updateSplitAllocationsById(controller.activeSplitId, {
      lineAssignments,
      sharedCharge: toNumber(sharedChargeInput),
    });
    setShowReview(true);
  };

  const hasParticipants = selectedFamilyMemberIds.length + guestParticipants.length > 0;
  const allLineItemsAssigned =
    splitLineItems.length > 0 &&
    splitLineItems.every((lineItem) => (assignmentsByLineItemId[lineItem.id] ?? []).length > 0);
  const canFinalizeSplit = Boolean(controller.activeSplitId && splitDetail && allLineItemsAssigned);
  const highestReachableStep: WizardStep = controller.activeSplitId
    ? 3
    : controller.activeFamilyId
    ? 2
    : 1;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        {([1, 2, 3] as WizardStep[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.stepWrapper, s > highestReachableStep && styles.stepWrapperDisabled]}
            onPress={() => setStep(s)}
            disabled={s > highestReachableStep}
            accessibilityRole="button"
            accessibilityLabel={`Step ${s}: ${STEP_LABELS[s]}`}
            accessibilityState={{ selected: step === s, disabled: s > highestReachableStep }}
          >
            <View style={[styles.stepBar, step >= s && styles.stepBarFilled]} />
            <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>

      {/* Step 1: Choose expense */}
      {step === 1 ? (
        <DarkCard radius={16}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepSectionTitle}>Choose expense</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={controller.loadLedger}
              disabled={controller.loading}
              accessibilityRole="button"
              accessibilityLabel="Sync expenses"
              accessibilityState={{ disabled: controller.loading, busy: controller.loading || controller.initialDataLoading }}
            >
              {controller.loading || controller.initialDataLoading ? (
                <ActivityIndicator size="small" color={Colors.green} />
              ) : (
                <Text style={styles.smallBtnText}>Sync</Text>
              )}
            </TouchableOpacity>
          </View>

          {!controller.activeFamilyId ? (
            <Text style={styles.emptyText}>Set an active family first. Go to Families to create or join one.</Text>
          ) : (
            <>
              <Text style={styles.emptyText}>Family: {activeFamily?.name ?? '-'}</Text>
              {controller.initialDataLoading && controller.ledgerItems.length === 0 ? (
                <LoadingRows label="Syncing expenses" count={3} />
              ) : null}
              {controller.ledgerItems.slice(0, 20).map((expense) => {
                const isSelected = selectedExpenseId === expense.id;
                return (
                  <TouchableOpacity
                    key={expense.id}
                    style={[styles.listItem, isSelected && styles.listItemActive]}
                    onPress={() => setSelectedExpenseId(expense.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select expense from ${expense.merchant}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={styles.listItemTitle}>{expense.merchant}</Text>
                    <Text style={styles.listItemMeta}>
                      {controller.formatCurrency(expense.totalAmount, expense.currency)} ·{' '}
                      {new Date(expense.transactionAt).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TextInput
                label="Shared charge"
                value={sharedChargeInput}
                onChangeText={setSharedChargeInput}
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
                theme={inputTheme}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, !controller.activeFamilyId && styles.continueBtnDisabled]}
            onPress={() => setStep(2)}
            disabled={!controller.activeFamilyId}
            accessibilityRole="button"
            accessibilityLabel="Continue to participants"
            accessibilityState={{ disabled: !controller.activeFamilyId }}
          >
            <Text style={styles.continueBtnText}>Continue →</Text>
          </TouchableOpacity>
        </DarkCard>
      ) : null}

      {/* Step 2: Select participants */}
      {step === 2 ? (
        <DarkCard radius={16}>
          <Text style={styles.stepSectionTitle}>Select participants</Text>
          <Text style={styles.emptyText}>Family members:</Text>
          <View style={styles.chipRow}>
            {activeFamily?.members.map((member) => {
              const selected = selectedFamilyMemberIds.includes(member.id);
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.participantChip, selected && styles.participantChipActive]}
                  onPress={() => toggleFamilyMember(member.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle participant ${member.displayName || member.email}`}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.participantChipText, selected && styles.participantChipTextActive]}>
                    {member.displayName || member.email}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.divider} />
          <View style={styles.guestRow}>
            <TextInput
              label="Add guest"
              value={guestInput}
              onChangeText={setGuestInput}
              mode="outlined"
              style={[styles.input, { flex: 1 }]}
              theme={inputTheme}
            />
            <TouchableOpacity
              style={styles.addGuestBtn}
              onPress={addGuest}
              accessibilityRole="button"
              accessibilityLabel="Add guest participant"
            >
              <Text style={styles.addGuestText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {guestParticipants.map((guest) => (
              <TouchableOpacity
                key={guest}
                style={[styles.participantChip, styles.participantChipActive]}
                onPress={() => setGuestParticipants((prev) => prev.filter((g) => g !== guest))}
                accessibilityRole="button"
                accessibilityLabel={`Remove guest ${guest}`}
              >
                <Text style={styles.participantChipTextActive}>{guest} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.continueBtn, (!controller.activeFamilyId || controller.loading || !hasParticipants) && styles.continueBtnDisabled]}
            onPress={createDraft}
            disabled={controller.loading || !controller.activeFamilyId || !hasParticipants}
            testID={TEST_IDS.splits.createButton}
            accessibilityRole="button"
            accessibilityLabel="Create split draft"
            accessibilityState={{ disabled: controller.loading || !controller.activeFamilyId || !hasParticipants }}
          >
            <Text style={styles.continueBtnText}>Create draft →</Text>
          </TouchableOpacity>
        </DarkCard>
      ) : null}

      {/* Step 3: Assign items */}
      {step === 3 ? (
        <DarkCard radius={16}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepSectionTitle}>Assign line items</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={controller.loadSplitSessions}
              disabled={controller.loading || !controller.activeFamilyId}
              accessibilityRole="button"
              accessibilityLabel="Sync split sessions"
              accessibilityState={{ disabled: controller.loading || !controller.activeFamilyId }}
            >
              <Text style={styles.smallBtnText}>Sync sessions</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.emptyText}>Active split: {controller.activeSplitId || '-'}</Text>
          {controller.splitSummaries.map((split) => (
            <TouchableOpacity
              key={split.id}
              style={styles.listItem}
              onPress={() => controller.loadSplitDetailById(split.id)}
              accessibilityRole="button"
              accessibilityLabel={`Load split session ${split.title || 'Split session'}`}
            >
              <Text style={styles.listItemTitle}>{split.title || 'Split session'}</Text>
              <Text style={styles.listItemMeta}>
                {split.status} · {controller.formatCurrency(split.totalAmount)}
              </Text>
            </TouchableOpacity>
          ))}
          {splitDetail && splitLineItems.length > 0 ? (
            <>
              {splitLineItems.map((lineItem) => (
                <View key={lineItem.id} style={styles.lineItemBlock}>
                  <Text style={styles.lineItemTitle}>
                    {lineItem.descriptionRaw} · {controller.formatCurrency(lineItem.totalPrice)}
                  </Text>
                  <View style={styles.chipRow}>
                    {splitParticipants.map((participant) => {
                      const assigned = (assignmentsByLineItemId[lineItem.id] ?? []).includes(participant.id);
                      return (
                        <TouchableOpacity
                          key={`${lineItem.id}-${participant.id}`}
                          style={[styles.participantChip, assigned && styles.participantChipActive]}
                          onPress={() => toggleAssignment(lineItem.id, participant.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Assign ${lineItem.descriptionRaw} to ${participant.displayName}`}
                          accessibilityState={{ selected: assigned }}
                        >
                          <Text style={[styles.participantChipText, assigned && styles.participantChipTextActive]}>
                            {participant.displayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.continueBtn, (!controller.activeSplitId || controller.loading || !allLineItemsAssigned) && styles.continueBtnDisabled]}
                onPress={saveAllocations}
                disabled={controller.loading || !controller.activeSplitId || !allLineItemsAssigned}
                testID={TEST_IDS.splits.saveAllocationsButton}
                accessibilityRole="button"
                accessibilityLabel="Save split allocations"
                accessibilityState={{ disabled: controller.loading || !controller.activeSplitId || !allLineItemsAssigned }}
              >
                <Text style={styles.continueBtnText}>Finalize split</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptyText}>Create or sync a split draft, then select a session with line items to continue.</Text>
          )}
          {showReview && splitDetail ? (
            <View style={styles.reviewBlock}>
              <View style={styles.divider} />
              <Text style={styles.stepSectionTitle}>Review and finalize</Text>
              <View style={styles.reviewBlock}>
                <Text style={styles.listItemTitle}>{splitDetail.split.title || 'Split'}</Text>
                <Text style={styles.listItemMeta}>
                  {splitDetail.split.status} · {controller.formatCurrency(splitDetail.split.totalAmount)}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.smallBtnOutline]}
                  onPress={async () => {
                    if (controller.activeSplitId) {
                      await controller.loadSplitBalancesById(controller.activeSplitId);
                    }
                  }}
                  disabled={controller.loading || !canFinalizeSplit}
                  accessibilityRole="button"
                  accessibilityLabel="Load split balances"
                  accessibilityState={{ disabled: controller.loading || !canFinalizeSplit }}
                >
                  <Text style={styles.smallBtnOutlineText}>Load balances</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.continueBtn, { flex: 1 }, (!canFinalizeSplit || controller.loading) && styles.continueBtnDisabled]}
                  onPress={async () => {
                    if (canFinalizeSplit && controller.activeSplitId) {
                      await controller.finalizeSplitById(controller.activeSplitId);
                      await controller.loadSplitBalancesById(controller.activeSplitId);
                    }
                  }}
                  disabled={controller.loading || !canFinalizeSplit}
                  accessibilityRole="button"
                  accessibilityLabel="Finalize split"
                  accessibilityState={{ disabled: controller.loading || !canFinalizeSplit }}
                >
                  <Text style={styles.continueBtnText}>Finalize split</Text>
                </TouchableOpacity>
              </View>
              {controller.splitBalanceSummary ? (
                <View style={styles.balanceBlock}>
                  <Text style={styles.balanceTitle}>Balances</Text>
                  {controller.splitBalanceSummary.balances.map((row) => (
                    <View key={row.participantId} style={styles.balanceRow}>
                      <Text style={styles.balanceName}>{row.displayName}</Text>
                      <Text style={styles.balanceValues}>
                        owed {controller.formatCurrency(row.owedAmount)} · net {controller.formatCurrency(row.netAmount)}
                      </Text>
                    </View>
                  ))}
                  {controller.splitBalanceSummary.settlements.length > 0 ? (
                    <>
                      <Text style={[styles.balanceTitle, { marginTop: 12 }]}>Settlements</Text>
                      {controller.splitBalanceSummary.settlements.map((row, i) => (
                        <Text
                          key={`${row.fromParticipantId}-${row.toParticipantId}-${i}`}
                          style={styles.listItemMeta}
                        >
                          {row.fromParticipantId} → {row.toParticipantId}: {controller.formatCurrency(row.amount)}
                        </Text>
                      ))}
                    </>
                  ) : (
                    <Text style={styles.emptyText}>No settlement transfers required.</Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </DarkCard>
      ) : null}

      {/* Back button */}
      {step > 1 ? (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setStep((s) => (s - 1) as WizardStep)}
          accessibilityRole="button"
          accessibilityLabel="Go back one split step"
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
  },
  stepWrapper: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepWrapperDisabled: {
    opacity: 0.38,
  },
  stepBar: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  stepBarFilled: {
    backgroundColor: Colors.green,
  },
  stepNum: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  stepNumActive: {
    color: Colors.green,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -8,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginVertical: 4,
  },
  listItem: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listItemActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenDim,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  listItemMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  activeIndicator: {
    fontSize: 12,
    color: Colors.green,
    fontWeight: '600',
    marginTop: 2,
  },
  continueBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  participantChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  participantChipActive: {
    backgroundColor: Colors.greenDim,
    borderColor: Colors.green,
  },
  participantChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  participantChipTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addGuestBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 2,
    justifyContent: 'center',
  },
  addGuestText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  lineItemBlock: {
    marginBottom: 12,
    gap: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lineItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  smallBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 12,
    color: Colors.green,
    fontWeight: '500',
  },
  smallBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  smallBtnOutlineText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  reviewBlock: {
    marginBottom: 12,
    gap: 3,
  },
  balanceBlock: {
    marginTop: 12,
    gap: 6,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceName: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  balanceValues: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
