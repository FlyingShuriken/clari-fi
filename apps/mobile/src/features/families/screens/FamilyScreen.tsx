import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { DarkCard } from '../../../components/ui/dark-card';
import { PillBadge } from '../../../components/ui/pill-badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { LoadingRows } from '../../../components/ui/loading-state';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

const inputTheme = {
  colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary },
};

export function FamilyScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const activeFamily = controller.families.find((f) => f.id === controller.activeFamilyId);
  const canManageMembers = activeFamily?.currentUserRole === 'OWNER';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {controller.subscription ? (
        <DarkCard radius={16}>
          <View style={styles.limitHeader}>
            <View>
              <Text style={styles.cardTitle}>Family sharing</Text>
              <Text style={styles.capacityHint}>
                Owner + {controller.subscription.family.additionalMembersAllowed} additional member{controller.subscription.family.additionalMembersAllowed === 1 ? '' : 's'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.managePlanBtn}
              onPress={() => navigation.navigate('Subscription')}
              accessibilityRole="button"
              accessibilityLabel={controller.subscription.plan === 'PREMIUM' ? 'Manage family plan' : 'Upgrade family sharing'}
            >
              <Text style={styles.managePlanText}>
                {controller.subscription.plan === 'PREMIUM' ? 'Manage' : 'Upgrade'}
              </Text>
            </TouchableOpacity>
          </View>
        </DarkCard>
      ) : controller.initialDataLoading ? (
        <DarkCard radius={16}>
          <LoadingRows label="Syncing family capacity" count={1} />
        </DarkCard>
      ) : null}

      {/* Create family card */}
      <DarkCard radius={16}>
        <Text style={styles.cardTitle}>Create family</Text>
        <TextInput
          label="Family name"
          value={controller.familyNameInput}
          onChangeText={controller.setFamilyNameInput}
          mode="outlined"
          style={styles.input}
          testID={TEST_IDS.families.nameInput}
          theme={inputTheme}
        />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={controller.createFamilyProfile}
          disabled={controller.loading}
          testID={TEST_IDS.families.createButton}
          accessibilityRole="button"
          accessibilityLabel="Create family"
          accessibilityState={{ disabled: controller.loading }}
        >
          <Text style={styles.primaryBtnText}>Create family</Text>
        </TouchableOpacity>
      </DarkCard>

      {/* Join family card */}
      <DarkCard radius={16}>
        <Text style={styles.cardTitle}>Join via invite code</Text>
        <TextInput
          label="Invite code"
          value={controller.familyInviteCodeInput}
          onChangeText={controller.setFamilyInviteCodeInput}
          mode="outlined"
          autoCapitalize="characters"
          style={styles.input}
          testID={TEST_IDS.families.inviteCodeInput}
          theme={inputTheme}
        />
        <TouchableOpacity
          style={[styles.secondaryBtn]}
          onPress={controller.joinFamilyByInviteCode}
          disabled={controller.loading}
          testID={TEST_IDS.families.joinButton}
          accessibilityRole="button"
          accessibilityLabel="Join family with invite code"
          accessibilityState={{ disabled: controller.loading }}
        >
          <Text style={styles.secondaryBtnText}>Join via code</Text>
        </TouchableOpacity>
        {controller.familyInviteLatestCode ? (
          <Text style={styles.codeHint}>
            Latest invite code: {controller.familyInviteLatestCode}
          </Text>
        ) : null}
      </DarkCard>

      {/* Families list */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Your families</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={controller.loadFamiliesList}
          disabled={controller.loading}
          testID={TEST_IDS.families.loadButton}
          accessibilityRole="button"
          accessibilityLabel="Sync families"
          accessibilityState={{ disabled: controller.loading, busy: controller.loading || controller.initialDataLoading }}
        >
          {controller.loading || controller.initialDataLoading ? (
            <ActivityIndicator size="small" color={Colors.green} />
          ) : (
            <Text style={styles.refreshText}>Sync</Text>
          )}
        </TouchableOpacity>
      </View>

      {controller.initialDataLoading && controller.families.length === 0 ? (
        <LoadingRows label="Syncing families" count={3} />
      ) : controller.families.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="No family workspace yet"
          message="Create a family to share expenses, invite members, and split receipts together."
        />
      ) : (
        controller.families.map((family) => {
          const isActive = family.id === controller.activeFamilyId;
          return (
            <DarkCard key={family.id} radius={16} glow={isActive ? 'green' : undefined}>
              <View style={styles.familyRow}>
                <View style={styles.familyInfo}>
                  <Text style={styles.familyName}>{family.name}</Text>
                  <Text style={styles.familyMeta}>
                    {family.currentUserRole ?? 'N/A'} · {family.members.length} member{family.members.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.setActiveBtn, isActive && styles.setActiveBtnActive]}
                  onPress={() => controller.setActiveFamilyId(family.id)}
                  accessibilityRole="button"
                  accessibilityLabel={isActive ? `${family.name} is the active family` : `Set ${family.name} as active family`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.setActiveBtnText, isActive && styles.setActiveBtnTextActive]}>
                    {isActive ? 'Active' : 'Set active'}
                  </Text>
                </TouchableOpacity>
              </View>
            </DarkCard>
          );
        })
      )}

      {/* Active family members */}
      {activeFamily ? (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Members — {activeFamily.name}</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={controller.createActiveFamilyInvite}
              disabled={controller.loading}
              testID={TEST_IDS.families.createInviteButton}
              accessibilityRole="button"
              accessibilityLabel={`Create invite for ${activeFamily.name}`}
              accessibilityState={{ disabled: controller.loading }}
            >
              <Text style={styles.refreshText}>+ Invite</Text>
            </TouchableOpacity>
          </View>
          {activeFamily.members.map((member) => (
            <DarkCard key={member.id} radius={16}>
              <View style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.displayName || member.email}</Text>
                  <Text style={styles.memberMeta}>
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </Text>
                </View>
                <PillBadge
                  label={member.role}
                  color={member.role === 'OWNER' ? 'green' : member.role === 'EDITOR' ? 'indigo' : 'amber'}
                />
              </View>
              {canManageMembers ? (
                <View style={styles.roleActions}>
                  {member.role !== 'OWNER' ? (
                    <TouchableOpacity
                      style={styles.roleChip}
                      onPress={() => controller.updateFamilyMemberRoleById(member.id, 'OWNER')}
                      accessibilityRole="button"
                      accessibilityLabel={`Make ${member.displayName || member.email} an owner`}
                    >
                      <Text style={styles.roleChipText}>Owner</Text>
                    </TouchableOpacity>
                  ) : null}
                  {member.role !== 'EDITOR' ? (
                    <TouchableOpacity
                      style={styles.roleChip}
                      onPress={() => controller.updateFamilyMemberRoleById(member.id, 'EDITOR')}
                      accessibilityRole="button"
                      accessibilityLabel={`Make ${member.displayName || member.email} an editor`}
                    >
                      <Text style={styles.roleChipText}>Editor</Text>
                    </TouchableOpacity>
                  ) : null}
                  {member.role !== 'VIEWER' ? (
                    <TouchableOpacity
                      style={styles.roleChip}
                      onPress={() => controller.updateFamilyMemberRoleById(member.id, 'VIEWER')}
                      accessibilityRole="button"
                      accessibilityLabel={`Make ${member.displayName || member.email} a viewer`}
                    >
                      <Text style={styles.roleChipText}>Viewer</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.roleChip, styles.roleChipDanger]}
                    onPress={() => controller.removeFamilyMemberById(member.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.displayName || member.email} from family`}
                  >
                    <Text style={[styles.roleChipText, styles.roleChipDangerText]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </DarkCard>
          ))}
        </>
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
    gap: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capacityHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  managePlanBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.greenDim,
  },
  managePlanText: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.surface,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  codeHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  refreshBtn: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    fontSize: 12,
    color: Colors.green,
    fontWeight: '500',
  },
  familyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  familyInfo: {
    flex: 1,
    gap: 3,
  },
  familyName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  familyMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  setActiveBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  setActiveBtnActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenDim,
  },
  setActiveBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  setActiveBtnTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  memberMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  roleActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  roleChip: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  roleChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  roleChipDanger: {
    borderColor: Colors.coral,
  },
  roleChipDangerText: {
    color: Colors.coral,
  },
});
