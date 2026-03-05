import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

export function FamilyScreen() {
  const controller = useClariFiController();
  const activeFamily = controller.families.find((family) => family.id === controller.activeFamilyId);
  const canManageMembers = activeFamily?.currentUserRole === 'OWNER';

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Family Mode" subtitle="Create, join, invite, and select active family" />
        <Card.Content style={styles.content}>
          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.loadFamiliesList}
              disabled={controller.loading}
              icon="refresh"
              testID={TEST_IDS.families.loadButton}
            >
              Load families
            </Button>
            <Button
              mode="outlined"
              onPress={controller.createActiveFamilyInvite}
              disabled={controller.loading || !controller.activeFamilyId}
              icon="link-variant"
              testID={TEST_IDS.families.createInviteButton}
            >
              Create invite
            </Button>
          </View>

          <TextInput
            label="Create family name"
            value={controller.familyNameInput}
            onChangeText={controller.setFamilyNameInput}
            mode="outlined"
            testID={TEST_IDS.families.nameInput}
          />
          <Button
            mode="contained"
            onPress={controller.createFamilyProfile}
            disabled={controller.loading}
            icon="account-group-outline"
            testID={TEST_IDS.families.createButton}
          >
            Create family
          </Button>

          <Divider />

          <TextInput
            label="Invite code"
            value={controller.familyInviteCodeInput}
            onChangeText={controller.setFamilyInviteCodeInput}
            mode="outlined"
            autoCapitalize="characters"
            testID={TEST_IDS.families.inviteCodeInput}
          />
          <Button
            mode="outlined"
            onPress={controller.joinFamilyByInviteCode}
            disabled={controller.loading}
            icon="account-plus-outline"
            testID={TEST_IDS.families.joinButton}
          >
            Join via code
          </Button>

          <Text variant="bodySmall" style={styles.meta}>
            Latest invite code: {controller.familyInviteLatestCode || '-'}
          </Text>
          <Text variant="bodySmall" style={styles.meta}>
            Active family: {activeFamily?.name || '-'}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Families" subtitle="Select active family for split wizard" />
        <Card.Content style={styles.content}>
          {controller.families.length === 0 ? (
            <Text variant="bodySmall" style={styles.meta}>
              No families yet.
            </Text>
          ) : (
            controller.families.map((family) => (
              <Card key={family.id} mode="outlined" style={styles.innerCard}>
                <Card.Content style={styles.listBlock}>
                  <View style={styles.rowBetween}>
                    <View style={styles.titleBlock}>
                      <Text variant="titleSmall">{family.name}</Text>
                      <Text variant="bodySmall" style={styles.meta}>
                        Role: {family.currentUserRole || 'N/A'} · Members: {family.members.length}
                      </Text>
                    </View>
                    <Button mode="text" onPress={() => controller.setActiveFamilyId(family.id)}>
                      {controller.activeFamilyId === family.id ? 'Active' : 'Set active'}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </Card.Content>
      </Card>

      {activeFamily ? (
        <Card mode="contained" style={styles.card}>
          <Card.Title title="Members" subtitle="Role and member controls for active family" />
          <Card.Content style={styles.content}>
            {activeFamily.members.map((member) => (
              <Card key={member.id} mode="outlined" style={styles.innerCard}>
                <Card.Content style={styles.listBlock}>
                  <Text variant="titleSmall">{member.displayName || member.email}</Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    {member.role} · joined {new Date(member.joinedAt).toLocaleDateString()}
                  </Text>

                  {canManageMembers ? (
                    <View style={styles.row}>
                      {member.role !== 'OWNER' ? (
                        <Chip onPress={() => controller.updateFamilyMemberRoleById(member.id, 'OWNER')}>
                          Make OWNER
                        </Chip>
                      ) : null}
                      {member.role !== 'EDITOR' ? (
                        <Chip onPress={() => controller.updateFamilyMemberRoleById(member.id, 'EDITOR')}>
                          Make EDITOR
                        </Chip>
                      ) : null}
                      {member.role !== 'VIEWER' ? (
                        <Chip onPress={() => controller.updateFamilyMemberRoleById(member.id, 'VIEWER')}>
                          Make VIEWER
                        </Chip>
                      ) : null}
                      <Chip onPress={() => controller.removeFamilyMemberById(member.id)}>Remove</Chip>
                    </View>
                  ) : null}
                </Card.Content>
              </Card>
            ))}
          </Card.Content>
        </Card>
      ) : null}
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
  titleBlock: {
    gap: 2,
    flexShrink: 1,
  },
  meta: {
    color: '#64748b',
  },
  innerCard: {
    borderRadius: 12,
  },
  listBlock: {
    gap: 6,
  },
});
