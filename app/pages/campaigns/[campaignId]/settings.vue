<script setup lang="ts">
definePageMeta({ layout: 'app' })

type CampaignPermission =
  | 'campaign.read'
  | 'campaign.update'
  | 'campaign.delete'
  | 'campaign.members.manage'
  | 'campaign.settings.manage'
  | 'campaign.public.manage'
  | 'content.read'
  | 'content.write'
  | 'recording.upload'
  | 'recording.transcribe'
  | 'document.edit'
  | 'summary.run'

type CampaignAccess = {
  role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
  permissions: CampaignPermission[]
} | null

type SettingsTab = 'general' | 'members' | 'public' | 'danger'

const route = useRoute()
const router = useRouter()
const campaignId = computed(() => route.params.campaignId as string)
const campaignAccess = inject<ComputedRef<CampaignAccess>>('campaignAccess', computed(() => null))
const canManageMembers = computed(() =>
  Boolean(campaignAccess.value?.permissions.includes('campaign.members.manage'))
)

const membership = useCampaignMembership()

const tabs = [
  { label: 'General', value: 'general' },
  { label: 'Members', value: 'members' },
  { label: 'Public Access', value: 'public' },
  { label: 'Danger Zone', value: 'danger' },
]

const activeTab = ref<SettingsTab>('members')

const {
  data: memberData,
  pending: membersPending,
  error: membersError,
  refresh: refreshMembers,
} = await useAsyncData(
  () => `campaign-members-${campaignId.value}`,
  () => membership.getMembers(campaignId.value),
  { immediate: false }
)

watch(
  () => [activeTab.value, canManageMembers.value] as const,
  async ([tab, canManage]) => {
    if (tab === 'members' && canManage) {
      await refreshMembers()
    }
  },
  { immediate: true }
)

const roleOptions = [
  { label: 'Collaborator', value: 'COLLABORATOR' },
  { label: 'Viewer', value: 'VIEWER' },
]

const inviteForm = reactive({
  email: '',
  role: 'VIEWER' as 'COLLABORATOR' | 'VIEWER',
})

const inviteAction = reactive({
  saving: false,
  error: '',
  success: '',
  link: '',
})

const memberAction = reactive({
  roleSavingMemberId: '',
  removeSavingMemberId: '',
  error: '',
  success: '',
})

const transferModalOpen = ref(false)
const transferForm = reactive({
  targetMemberId: '',
  password: '',
  confirmationText: '',
})
const transferAction = reactive({
  saving: false,
  error: '',
  success: '',
})

const transferCandidates = computed(() =>
  (memberData.value?.members || []).filter((member) => member.role !== 'OWNER')
)
const transferMemberOptions = computed(() =>
  transferCandidates.value.map((member) => ({
    label: `${member.user.name} (${member.user.email})`,
    value: member.id,
  }))
)

const openTransferModal = () => {
  transferAction.error = ''
  transferAction.success = ''
  transferForm.targetMemberId = transferCandidates.value[0]?.id || ''
  transferForm.password = ''
  transferForm.confirmationText = ''
  transferModalOpen.value = true
}

const createInvite = async () => {
  inviteAction.error = ''
  inviteAction.success = ''
  inviteAction.link = ''
  inviteAction.saving = true

  try {
    const result = await membership.createInvite(campaignId.value, {
      email: inviteForm.email,
      role: inviteForm.role,
    })
    if (!result) {
      throw new Error('Invite response was empty.')
    }
    inviteForm.email = ''
    inviteAction.link = result.acceptUrl
    inviteAction.success = `Invite created for ${result.invite.email}.`
    await refreshMembers()
  } catch (error) {
    inviteAction.error = (error as Error & { message?: string }).message || 'Unable to create invite.'
  } finally {
    inviteAction.saving = false
  }
}

const copyInviteLink = async () => {
  if (!inviteAction.link || !process.client) return
  try {
    await navigator.clipboard.writeText(inviteAction.link)
    inviteAction.success = 'Invite link copied to clipboard.'
  } catch {
    inviteAction.error = 'Unable to copy invite link.'
  }
}

const updateMemberRole = async (memberId: string, role: 'COLLABORATOR' | 'VIEWER') => {
  memberAction.error = ''
  memberAction.success = ''
  memberAction.roleSavingMemberId = memberId

  try {
    await membership.updateMemberRole(campaignId.value, memberId, { role })
    memberAction.success = 'Member role updated.'
    await refreshMembers()
  } catch (error) {
    memberAction.error = (error as Error & { message?: string }).message || 'Unable to update member role.'
  } finally {
    memberAction.roleSavingMemberId = ''
  }
}

const removeMember = async (memberId: string, close: () => void) => {
  memberAction.error = ''
  memberAction.success = ''
  memberAction.removeSavingMemberId = memberId

  try {
    await membership.removeMember(campaignId.value, memberId)
    memberAction.success = 'Member removed from campaign.'
    close()
    await refreshMembers()
  } catch (error) {
    memberAction.error = (error as Error & { message?: string }).message || 'Unable to remove member.'
  } finally {
    memberAction.removeSavingMemberId = ''
  }
}

const transferOwnership = async () => {
  transferAction.error = ''
  transferAction.success = ''

  if (!transferForm.targetMemberId) {
    transferAction.error = 'Select a member to transfer ownership.'
    return
  }

  if (transferForm.confirmationText.trim().toUpperCase() !== 'TRANSFER') {
    transferAction.error = 'Type TRANSFER to confirm ownership transfer.'
    return
  }

  transferAction.saving = true

  try {
    await membership.transferOwnership(campaignId.value, {
      targetMemberId: transferForm.targetMemberId,
      password: transferForm.password,
    })
    transferAction.success = 'Ownership transferred. Redirecting to campaign overview...'
    transferModalOpen.value = false
    await router.push(`/campaigns/${campaignId.value}`)
  } catch (error) {
    transferAction.error = (error as Error & { message?: string }).message || 'Unable to transfer ownership.'
  } finally {
    transferAction.saving = false
  }
}

const formatDateTime = (value: string) => new Date(value).toLocaleString()
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Settings</p>
      <h1 class="mt-2 text-2xl font-semibold">Campaign settings</h1>
    </div>

    <UCard>
      <UTabs v-model="activeTab" :items="tabs" :content="false" />
    </UCard>

    <UCard v-if="activeTab === 'general'">
      <template #header>
        <h2 class="text-lg font-semibold">General</h2>
      </template>
      <p class="text-sm text-muted">General campaign settings are scheduled for a later milestone.</p>
    </UCard>

    <div v-else-if="activeTab === 'members'" class="space-y-6">
      <UAlert
        v-if="!canManageMembers"
        color="warning"
        variant="subtle"
        title="Owner access required"
        description="Only campaign owners can manage members and invites in this release."
      />

      <template v-else>
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">Members</h2>
                <p class="text-sm text-muted">Invite users, manage roles, and transfer ownership.</p>
              </div>
              <UButton
                color="warning"
                variant="soft"
                icon="i-lucide-repeat"
                @click="openTransferModal"
              >
                Transfer ownership
              </UButton>
            </div>
          </template>

          <div v-if="memberAction.success" class="mb-3 text-sm text-success">{{ memberAction.success }}</div>
          <div v-if="memberAction.error" class="mb-3 text-sm text-error">{{ memberAction.error }}</div>

          <div v-if="membersPending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="membersError" class="space-y-3">
            <p class="text-sm text-error">Unable to load campaign members.</p>
            <UButton variant="outline" @click="() => refreshMembers()">Try again</UButton>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="member in memberData?.members || []"
              :key="member.id"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">{{ member.user.name }}</p>
                  <p class="text-xs text-muted">{{ member.user.email }}</p>
                  <p class="text-xs text-muted">Joined: {{ formatDateTime(member.createdAt) }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge v-if="member.role === 'OWNER'" color="primary" variant="subtle">Owner</UBadge>
                  <template v-else>
                    <USelect
                      :items="roleOptions"
                      :model-value="member.role"
                      size="xs"
                      class="w-36"
                      :loading="memberAction.roleSavingMemberId === member.id"
                      @update:model-value="(value) => updateMemberRole(member.id, value as 'COLLABORATOR' | 'VIEWER')"
                    />
                    <UPopover :content="{ side: 'left', align: 'end' }" :ui="{ content: 'w-72 p-3' }">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-lucide-user-minus"
                        aria-label="Remove member"
                      />
                      <template #content="{ close }">
                        <div class="space-y-3">
                          <p class="text-sm text-muted">
                            Remove {{ member.user.name }} from this campaign?
                          </p>
                          <div class="flex justify-end gap-2">
                            <UButton size="xs" variant="ghost" color="neutral" @click="close">Cancel</UButton>
                            <UButton
                              size="xs"
                              color="error"
                              :loading="memberAction.removeSavingMemberId === member.id"
                              @click="removeMember(member.id, close)"
                            >
                              Remove
                            </UButton>
                          </div>
                        </div>
                      </template>
                    </UPopover>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Invite member</h3>
          </template>

          <div class="grid gap-4 sm:grid-cols-[1fr_180px_auto]">
            <UInput v-model="inviteForm.email" type="email" placeholder="player@example.com" />
            <USelect v-model="inviteForm.role" :items="roleOptions" />
            <UButton :loading="inviteAction.saving" @click="createInvite">Create invite</UButton>
          </div>

          <p v-if="inviteAction.success" class="mt-3 text-sm text-success">{{ inviteAction.success }}</p>
          <p v-if="inviteAction.error" class="mt-3 text-sm text-error">{{ inviteAction.error }}</p>

          <div v-if="inviteAction.link" class="mt-3 rounded-md border border-default bg-muted/30 p-3">
            <p class="text-xs text-muted">Invite link</p>
            <p class="mt-1 break-all text-sm">{{ inviteAction.link }}</p>
            <UButton size="xs" class="mt-2" variant="outline" @click="copyInviteLink">Copy link</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Pending invites</h3>
          </template>

          <div v-if="!memberData?.pendingInvites?.length" class="text-sm text-muted">
            No pending invites.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="invite in memberData.pendingInvites"
              :key="invite.id"
              class="rounded-md border border-default bg-elevated/20 p-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">{{ invite.email }}</p>
                  <p class="text-xs text-muted">
                    Role: {{ invite.role }} · Expires: {{ formatDateTime(invite.expiresAt) }}
                  </p>
                </div>
                <UBadge color="warning" variant="subtle">Pending</UBadge>
              </div>
            </div>
          </div>
        </UCard>
      </template>
    </div>

    <UCard v-else-if="activeTab === 'public'">
      <template #header>
        <h2 class="text-lg font-semibold">Public Access</h2>
      </template>
      <p class="text-sm text-muted">Public sharing controls are scheduled for Milestone UM-5.</p>
    </UCard>

    <UCard v-else>
      <template #header>
        <h2 class="text-lg font-semibold">Danger Zone</h2>
      </template>
      <p class="text-sm text-muted">Additional destructive campaign actions will be added in a later milestone.</p>
    </UCard>

    <UModal
      v-model:open="transferModalOpen"
      title="Transfer campaign ownership"
      description="This action changes campaign ownership immediately and demotes you to collaborator."
    >
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-muted">New owner</label>
            <USelect
              v-model="transferForm.targetMemberId"
              :items="transferMemberOptions"
              placeholder="Select member"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm text-muted">Confirm with password</label>
            <UInput v-model="transferForm.password" type="password" placeholder="••••••••••" />
          </div>

          <div>
            <label class="mb-2 block text-sm text-muted">Type TRANSFER to confirm</label>
            <UInput v-model="transferForm.confirmationText" placeholder="TRANSFER" />
          </div>

          <p v-if="transferAction.error" class="text-sm text-error">{{ transferAction.error }}</p>
          <p v-if="transferAction.success" class="text-sm text-success">{{ transferAction.success }}</p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="transferModalOpen = false">Cancel</UButton>
          <UButton color="warning" :loading="transferAction.saving" @click="transferOwnership">
            Transfer ownership
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
