import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { DarkCard } from '../../../components/ui/dark-card';
import { LoadingRows } from '../../../components/ui/loading-state';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Select family',
  2: 'Select expense',
  3: 'Select participants',
  4: 'Assign items',
  5: 'Review & finalize',
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
    setStep(4);
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
    setStep(5);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
          <TouchableOpacity key={s} style={styles.stepWrapper} onPress={() => setStep(s)}>
            <View style={[styles.stepBar, step >= s && styles.stepBarFilled]} />
            <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>

      {/* Step 1: Select family */}
      {step === 1 ? (
        <DarkCard radius={16}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepSectionTitle}>Select active family</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={controller.loadFamiliesList}
              disabled={controller.loading}
            >
              {controller.loading || controller.initialDataLoading ? (
                <ActivityIndicator size="small" color={Colors.green} />
              ) : (
                <Text style={styles.smallBtnText}>Sync</Text>
              )}
            </TouchableOpacity>
          </View>
          {controller.initialDataLoading && controller.families.length === 0 ? (
            <LoadingRows label="Syncing families" count={2} />
          ) : controller.families.length === 0 ? (
            <Text style={styles.emptyText}>No families found. Go to Families tab to create one.</Text>
          ) : (
            controller.families.map((family) => {
              const isActive = family.id === controller.activeFamilyId;
              return (
                <TouchableOpacity
                  key={family.id}
                  style={[styles.listItem, isActive && styles.listItemActive]}
                  onPress={() => controller.setActiveFamilyId(family.id)}
                >
                  <Text style={styles.listItemTitle}>{family.name}</Text>
                  <Text style={styles.listItemMeta}>
                    {family.currentUserRole ?? 'N/A'} · {family.members.length} members
                  </Text>
                  {isActive ? (
                    <Text style={styles.activeIndicator}>✓ Active</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity
            style={[styles.continueBtn, !controller.activeFamilyId && styles.continueBtnDisabled]}
            onPress={() => setStep(2)}
            disabled={!controller.activeFamilyId}
          >
            <Text style={styles.continueBtnText}>Continue →</Text>
          </TouchableOpacity>
        </DarkCard>
      ) : null}

      {/* Step 2: Select expense */}
      {step === 2 ? (
        <DarkCard radius={16}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepSectionTitle}>Select expense</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={controller.loadLedger}
              disabled={controller.loading}
              testID={TEST_IDS.ledger.refreshButton}
            >
              {controller.loading || controller.initialDataLoading ? (
                <ActivityIndicator size="small" color={Colors.green} />
              ) : (
                <Text style={styles.smallBtnText}>Sync</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.emptyText}>
            Family: {activeFamily?.name ?? '-'}
          </Text>
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
          <TouchableOpacity style={styles.continueBtn} onPress={() => setStep(3)}>
            <Text style={styles.continueBtnText}>Continue →</Text>
          </TouchableOpacity>
        </DarkCard>
      ) : null}

      {/* Step 3: Select participants */}
      {step === 3 ? (
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
            <TouchableOpacity style={styles.addGuestBtn} onPress={addGuest}>
              <Text style={styles.addGuestText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {guestParticipants.map((guest) => (
              <TouchableOpacity
                key={guest}
                style={[styles.participantChip, styles.participantChipActive]}
                onPress={() => setGuestParticipants((prev) => prev.filter((g) => g !== guest))}
              >
                <Text style={styles.participantChipTextActive}>{guest} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.continueBtn, (!controller.activeFamilyId || controller.loading) && styles.continueBtnDisabled]}
            onPress={createDraft}
            disabled={controller.loading || !controller.activeFamilyId}
            testID={TEST_IDS.splits.createButton}
          >
            <Text style={styles.continueBtnText}>Create draft →</Text>
          </TouchableOpacity>
        </DarkCard>
      ) : null}

      {/* Step 4: Assign items */}
      {step === 4 ? (
        <DarkCard radius={16}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepSectionTitle}>Assign line items</Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={controller.loadSplitSessions}
              disabled={controller.loading || !controller.activeFamilyId}
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
                style={[styles.continueBtn, (!controller.activeSplitId || controller.loading) && styles.continueBtnDisabled]}
                onPress={saveAllocations}
                disabled={controller.loading || !controller.activeSplitId}
                testID={TEST_IDS.splits.saveAllocationsButton}
              >
                <Text style={styles.continueBtnText}>Save allocations →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptyText}>Load a split with line items to continue.</Text>
          )}
        </DarkCard>
      ) : null}

      {/* Step 5: Review and finalize */}
      {step === 5 ? (
        <DarkCard radius={16}>
          <Text style={styles.stepSectionTitle}>Review and finalize</Text>
          {splitDetail ? (
            <View style={styles.reviewBlock}>
              <Text style={styles.listItemTitle}>{splitDetail.split.title || 'Split'}</Text>
              <Text style={styles.listItemMeta}>
                {splitDetail.split.status} · {controller.formatCurrency(splitDetail.split.totalAmount)}
              </Text>
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.smallBtn, styles.smallBtnOutline]}
              onPress={async () => {
                if (controller.activeSplitId) {
                  await controller.loadSplitBalancesById(controller.activeSplitId);
                }
              }}
              disabled={controller.loading || !controller.activeSplitId}
              testID={TEST_IDS.splits.loadBalancesButton}
            >
              <Text style={styles.smallBtnOutlineText}>Load balances</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.continueBtn, { flex: 1 }, (!controller.activeSplitId || controller.loading) && styles.continueBtnDisabled]}
              onPress={async () => {
                if (controller.activeSplitId) {
                  await controller.finalizeSplitById(controller.activeSplitId);
                  await controller.loadSplitBalancesById(controller.activeSplitId);
                }
              }}
              disabled={controller.loading || !controller.activeSplitId}
              testID={TEST_IDS.splits.finalizeButton}
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
        </DarkCard>
      ) : null}

      {/* Back button */}
      {step > 1 ? (
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => (s - 1) as WizardStep)}>
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
    alignItems: 'center',
    gap: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 2,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.surface,
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
