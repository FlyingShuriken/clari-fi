import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

type WizardStep = 1 | 2 | 3 | 4 | 5;

function toNumber(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

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
    () => controller.families.find((family) => family.id === controller.activeFamilyId) ?? null,
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
    if (!splitDetail || splitLineItems.length === 0 || splitParticipants.length === 0) {
      return;
    }
    setAssignmentsByLineItemId((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const lineItem of splitLineItems) {
        const current = next[lineItem.id] ?? [];
        if (current.length === 0) {
          next[lineItem.id] = splitParticipants.map((participant) => participant.id);
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [splitDetail?.split.id, splitLineItems, splitParticipants]);

  const toggleFamilyMember = (familyMemberId: string) => {
    setSelectedFamilyMemberIds((previous) =>
      previous.includes(familyMemberId)
        ? previous.filter((item) => item !== familyMemberId)
        : [...previous, familyMemberId],
    );
  };

  const addGuestParticipant = () => {
    const trimmed = guestInput.trim();
    if (!trimmed || guestParticipants.includes(trimmed)) {
      return;
    }
    setGuestParticipants((previous) => [...previous, trimmed]);
    setGuestInput('');
  };

  const removeGuestParticipant = (name: string) => {
    setGuestParticipants((previous) => previous.filter((item) => item !== name));
  };

  const toggleAssignment = (lineItemId: string, participantId: string) => {
    setAssignmentsByLineItemId((previous) => {
      const current = previous[lineItemId] ?? [];
      const next = current.includes(participantId)
        ? current.filter((item) => item !== participantId)
        : [...current, participantId];
      return {
        ...previous,
        [lineItemId]: next,
      };
    });
  };

  const createDraft = async () => {
    if (!controller.activeFamilyId) {
      return;
    }

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
    if (!controller.activeSplitId || !splitDetail || splitLineItems.length === 0) {
      return;
    }

    const lineAssignments = splitLineItems.map((lineItem) => ({
      expenseLineItemId: lineItem.id,
      participantIds: assignmentsByLineItemId[lineItem.id] ?? [],
    }));

    if (lineAssignments.some((assignment) => assignment.participantIds.length === 0)) {
      throw new Error('Each line item must have at least one participant selected.');
    }

    await controller.updateSplitAllocationsById(controller.activeSplitId, {
      lineAssignments,
      sharedCharge: toNumber(sharedChargeInput),
    });
    setStep(5);
  };

  const activeStepLabel = (() => {
    switch (step) {
      case 1:
        return '1. Select family';
      case 2:
        return '2. Select expense';
      case 3:
        return '3. Select participants';
      case 4:
        return '4. Assign items';
      case 5:
        return '5. Review and finalize';
      default:
        return '';
    }
  })();

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Split Wizard" subtitle={activeStepLabel} />
        <Card.Content style={styles.content}>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((stepNumber) => (
              <Chip
                key={stepNumber}
                selected={step === stepNumber}
                onPress={() => setStep(stepNumber as WizardStep)}
              >
                {stepNumber}
              </Chip>
            ))}
          </View>

          {step === 1 ? (
            <>
              <View style={styles.row}>
                <Button
                  mode="contained"
                  onPress={controller.loadFamiliesList}
                  disabled={controller.loading}
                  icon="refresh"
                >
                  Load families
                </Button>
              </View>
              {controller.families.length === 0 ? (
                <Text variant="bodySmall" style={styles.meta}>
                  No families found.
                </Text>
              ) : (
                controller.families.map((family) => (
                  <Card key={family.id} mode="outlined" style={styles.innerCard}>
                    <Card.Content style={styles.listBlock}>
                      <View style={styles.rowBetween}>
                        <Text variant="titleSmall">{family.name}</Text>
                        <Button mode="text" onPress={() => controller.setActiveFamilyId(family.id)}>
                          {controller.activeFamilyId === family.id ? 'Active' : 'Use'}
                        </Button>
                      </View>
                      <Text variant="bodySmall" style={styles.meta}>
                        Role {family.currentUserRole || 'N/A'} · members {family.members.length}
                      </Text>
                    </Card.Content>
                  </Card>
                ))
              )}
              <Button mode="contained" disabled={!controller.activeFamilyId} onPress={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text variant="bodySmall" style={styles.meta}>
                Active family: {activeFamily?.name || '-'}
              </Text>
              <View style={styles.row}>
                <Button
                  mode="contained"
                  onPress={controller.loadLedger}
                  disabled={controller.loading}
                  icon="refresh"
                  testID={TEST_IDS.ledger.refreshButton}
                >
                  Load expenses
                </Button>
                <Button mode="outlined" onPress={() => setSelectedExpenseId('')}>
                  Manual split
                </Button>
              </View>
              {controller.ledgerItems.length === 0 ? (
                <Text variant="bodySmall" style={styles.meta}>
                  No expenses loaded yet.
                </Text>
              ) : (
                controller.ledgerItems.slice(0, 20).map((expense) => (
                  <Card key={expense.id} mode="outlined" style={styles.innerCard}>
                    <Card.Content style={styles.listBlock}>
                      <View style={styles.rowBetween}>
                        <Text variant="titleSmall">{expense.merchant}</Text>
                        <Button mode="text" onPress={() => setSelectedExpenseId(expense.id)}>
                          {selectedExpenseId === expense.id ? 'Selected' : 'Select'}
                        </Button>
                      </View>
                      <Text variant="bodySmall" style={styles.meta}>
                        {controller.formatCurrency(expense.totalAmount, expense.currency)} ·{' '}
                        {new Date(expense.transactionAt).toLocaleDateString()}
                      </Text>
                    </Card.Content>
                  </Card>
                ))
              )}
              <TextInput
                label="Shared charge"
                value={sharedChargeInput}
                onChangeText={setSharedChargeInput}
                keyboardType="decimal-pad"
                mode="outlined"
              />
              <Button mode="contained" onPress={() => setStep(3)}>
                Continue
              </Button>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text variant="bodySmall" style={styles.meta}>
                Select participants from active family and add guests if needed.
              </Text>

              {activeFamily?.members.map((member) => (
                <Chip
                  key={member.id}
                  selected={selectedFamilyMemberIds.includes(member.id)}
                  onPress={() => toggleFamilyMember(member.id)}
                >
                  {member.displayName || member.email}
                </Chip>
              ))}

              <Divider />

              <TextInput
                label="Add guest participant"
                value={guestInput}
                onChangeText={setGuestInput}
                mode="outlined"
              />
              <View style={styles.row}>
                <Button mode="outlined" onPress={addGuestParticipant}>
                  Add guest
                </Button>
              </View>
              <View style={styles.row}>
                {guestParticipants.map((guest) => (
                  <Chip key={guest} onClose={() => removeGuestParticipant(guest)}>
                    {guest}
                  </Chip>
                ))}
              </View>

              <Button
                mode="contained"
                onPress={createDraft}
                disabled={controller.loading || !controller.activeFamilyId}
                testID={TEST_IDS.splits.createButton}
              >
                Create split draft
              </Button>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text variant="bodySmall" style={styles.meta}>
                Active split: {controller.activeSplitId || '-'}
              </Text>
              <View style={styles.row}>
                <Button
                  mode="outlined"
                  onPress={controller.loadSplitSessions}
                  disabled={controller.loading || !controller.activeFamilyId}
                >
                  Load sessions
                </Button>
              </View>
              {controller.splitSummaries.map((split) => (
                <Card key={split.id} mode="outlined" style={styles.innerCard}>
                  <Card.Content style={styles.listBlock}>
                    <View style={styles.rowBetween}>
                      <Text variant="bodyMedium">{split.title || 'Split session'}</Text>
                      <Button
                        mode="text"
                        onPress={async () => {
                          await controller.loadSplitDetailById(split.id);
                        }}
                      >
                        Use
                      </Button>
                    </View>
                    <Text variant="bodySmall" style={styles.meta}>
                      {split.status} · {controller.formatCurrency(split.totalAmount)}
                    </Text>
                  </Card.Content>
                </Card>
              ))}

              {splitDetail && splitLineItems.length > 0 ? (
                <>
                  <Divider />
                  {splitLineItems.map((lineItem) => (
                    <Card key={lineItem.id} mode="outlined" style={styles.innerCard}>
                      <Card.Content style={styles.listBlock}>
                        <Text variant="titleSmall">
                          {lineItem.descriptionRaw} · {controller.formatCurrency(lineItem.totalPrice)}
                        </Text>
                        <View style={styles.row}>
                          {splitParticipants.map((participant) => (
                            <Chip
                              key={`${lineItem.id}-${participant.id}`}
                              selected={(assignmentsByLineItemId[lineItem.id] ?? []).includes(participant.id)}
                              onPress={() => toggleAssignment(lineItem.id, participant.id)}
                            >
                              {participant.displayName}
                            </Chip>
                          ))}
                        </View>
                      </Card.Content>
                    </Card>
                  ))}

                  <Button
                    mode="contained"
                    onPress={saveAllocations}
                    disabled={controller.loading || !controller.activeSplitId}
                    testID={TEST_IDS.splits.saveAllocationsButton}
                  >
                    Save allocations
                  </Button>
                </>
              ) : (
                <Text variant="bodySmall" style={styles.meta}>
                  Load a split with line items to continue.
                </Text>
              )}
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Text variant="bodySmall" style={styles.meta}>
                Active split: {controller.activeSplitId || '-'}
              </Text>
              {splitDetail ? (
                <>
                  <Text variant="titleSmall">
                    {splitDetail.split.title || 'Split'} · {splitDetail.split.status}
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Total {controller.formatCurrency(splitDetail.split.totalAmount)}
                  </Text>
                </>
              ) : null}
              <View style={styles.row}>
                <Button
                  mode="outlined"
                  onPress={async () => {
                    if (controller.activeSplitId) {
                      await controller.loadSplitBalancesById(controller.activeSplitId);
                    }
                  }}
                  disabled={controller.loading || !controller.activeSplitId}
                  testID={TEST_IDS.splits.loadBalancesButton}
                >
                  Load balances
                </Button>
                <Button
                  mode="contained"
                  onPress={async () => {
                    if (controller.activeSplitId) {
                      await controller.finalizeSplitById(controller.activeSplitId);
                      await controller.loadSplitBalancesById(controller.activeSplitId);
                    }
                  }}
                  disabled={controller.loading || !controller.activeSplitId}
                  testID={TEST_IDS.splits.finalizeButton}
                >
                  Finalize split
                </Button>
              </View>

              {controller.splitBalanceSummary ? (
                <>
                  <Divider />
                  <Text variant="titleSmall">Balances</Text>
                  {controller.splitBalanceSummary.balances.map((row) => (
                    <Text key={row.participantId} variant="bodySmall" style={styles.meta}>
                      {row.displayName}: owed {controller.formatCurrency(row.owedAmount)} · paid{' '}
                      {controller.formatCurrency(row.paidAmount)} · net{' '}
                      {controller.formatCurrency(row.netAmount)}
                    </Text>
                  ))}
                  <Text variant="titleSmall">Settlements</Text>
                  {controller.splitBalanceSummary.settlements.length === 0 ? (
                    <Text variant="bodySmall" style={styles.meta}>
                      No settlement transfers required.
                    </Text>
                  ) : (
                    controller.splitBalanceSummary.settlements.map((row, index) => (
                      <Text
                        key={`${row.fromParticipantId}-${row.toParticipantId}-${index}`}
                        variant="bodySmall"
                        style={styles.meta}
                      >
                        {row.fromParticipantId} → {row.toParticipantId}: {controller.formatCurrency(row.amount)}
                      </Text>
                    ))
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </Card.Content>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
  content: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  innerCard: {
    borderRadius: 12,
  },
  listBlock: {
    gap: 6,
  },
  meta: {
    color: '#64748b',
  },
});
