<script setup lang="ts">
import { z } from 'zod'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
definePageMeta({ layout: 'dashboard' })

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
  hasDmAccess: boolean
  permissions: CampaignPermission[]
} | null

type SettingsTab = 'general' | 'members' | 'public'

const route = useRoute()
const router = useRouter()
const campaignId = computed(() => route.params.campaignId as string)
const campaignAccess = inject<ComputedRef<CampaignAccess>>('campaignAccess', computed(() => null))
const canManageMembers = computed(() =>
  Boolean(campaignAccess.value?.permissions.includes('campaign.members.manage'))
)
const canManagePublic = computed(() =>
  Boolean(campaignAccess.value?.permissions.includes('campaign.public.manage'))
)
const canManageCalendar = computed(() =>
  Boolean(campaignAccess.value?.permissions.includes('campaign.update'))
)

const membership = useCampaignMembership()
const publicAccessApi = useCampaignPublicAccess()

const tabs = [
  { label: 'Calendar', value: 'general', slot: 'general', icon: 'i-lucide-calendar-days' },
  { label: 'Members', value: 'members', slot: 'members', icon: 'i-lucide-users' },
  { label: 'Public access', value: 'public', slot: 'public', icon: 'i-lucide-globe' },
]

const activeTab = ref<SettingsTab>('general')

const memberCache = useRetainedResource<Awaited<ReturnType<typeof membership.getMembers>>>(() => `campaign-members-${campaignId.value}`)
const publicCache = useRetainedResource<Awaited<ReturnType<typeof publicAccessApi.getSettings>>>(() => `campaign-public-access-${campaignId.value}`)

const {
  data: memberData,
  pending: membersPending,
  error: membersError,
  refresh: refreshMembers,
} = await useAsyncData(
  () => `campaign-members-${campaignId.value}`,
  () => memberCache.load(() => membership.getMembers(campaignId.value)),
  { immediate: false, default: memberCache.get }
)

const {
  data: publicAccessData,
  pending: publicAccessPending,
  error: publicAccessError,
  refresh: refreshPublicAccess,
} = await useAsyncData(
  () => `campaign-public-access-${campaignId.value}`,
  () => publicCache.load(() => publicAccessApi.getSettings(campaignId.value)),
  { immediate: false, default: publicCache.get }
)

watch(
  () => [activeTab.value, canManageMembers.value, canManagePublic.value] as const,
  async ([tab, canManageMembersTab, canManagePublicTab]) => {
    if (tab === 'members' && canManageMembersTab) {
      await refreshMembers()
    }
    if (tab === 'public' && canManagePublicTab) {
      await refreshPublicAccess()
    }
  },
  { immediate: true }
)

const roleOptions = [
  { label: 'Collaborator', value: 'COLLABORATOR' },
  { label: 'Viewer', value: 'VIEWER' },
]

const inviteSchema = z.object({ email: z.email('Enter a valid email address.'), role: z.enum(['VIEWER', 'COLLABORATOR']) })
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
  dmAccessSavingMemberId: '',
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

const membersBusy = computed(() => inviteAction.saving || Boolean(memberAction.roleSavingMemberId || memberAction.dmAccessSavingMemberId || memberAction.removeSavingMemberId) || transferAction.saving)
const openTransferModal = () => {
  if (membersBusy.value || !canManageMembers.value) return
  transferAction.error = ''
  transferAction.success = ''
  transferForm.targetMemberId = transferCandidates.value[0]?.id || ''
  transferForm.password = ''
  transferForm.confirmationText = ''
  transferModalOpen.value = true
}

const createInvite = async () => {
  if (membersBusy.value || !canManageMembers.value) return
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
  if (!inviteAction.link || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(inviteAction.link)
    inviteAction.success = 'Invite link copied to clipboard.'
  } catch {
    inviteAction.error = 'Unable to copy invite link.'
  }
}

const updateMemberRole = async (memberId: string, role: 'COLLABORATOR' | 'VIEWER') => {
  if (membersBusy.value || !canManageMembers.value) return
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

const updateMemberDmAccess = async (memberId: string, hasDmAccess: boolean) => {
  if (membersBusy.value || !canManageMembers.value) return
  memberAction.error = ''
  memberAction.success = ''
  memberAction.dmAccessSavingMemberId = memberId

  try {
    await membership.updateMemberRole(campaignId.value, memberId, { hasDmAccess })
    memberAction.success = 'DM access updated.'
    await refreshMembers()
  } catch (error) {
    memberAction.error = (error as Error & { message?: string }).message || 'Unable to update DM access.'
  } finally {
    memberAction.dmAccessSavingMemberId = ''
  }
}

const removeMember = async (memberId: string) => {
  if (membersBusy.value || !canManageMembers.value) return
  memberAction.error = ''
  memberAction.success = ''
  memberAction.removeSavingMemberId = memberId

  try {
    await membership.removeMember(campaignId.value, memberId)
    memberAction.success = 'Member removed from campaign.'
    await refreshMembers()
  } catch (error) {
    memberAction.error = (error as Error & { message?: string }).message || 'Unable to remove member.'
    throw new Error(memberAction.error, { cause: error })
  } finally {
    memberAction.removeSavingMemberId = ''
  }
}

const transferOwnership = async () => {
  if (membersBusy.value || !canManageMembers.value) return
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

const publicAction = reactive({
  saving: false,
  regenerating: false,
  error: '',
  success: '',
})

type PublicAccessToggleField =
  | 'isEnabled'
  | 'isListed'
  | 'showCharacters'
  | 'showRecaps'
  | 'showSessions'
  | 'showGlossary'
  | 'showQuests'
  | 'showMilestones'
  | 'showMaps'
  | 'showJournal'

const savePublicAccess = async (payload: Parameters<typeof publicAccessApi.updateSettings>[1]) => {
  if (!canManagePublic.value || publicAction.saving || publicAction.regenerating) return
  publicAction.error = ''
  publicAction.success = ''
  publicAction.saving = true

  try {
    const updated = await publicAccessApi.updateSettings(campaignId.value, payload)
    if (!updated) {
      throw new Error('Public access update failed.')
    }
    publicCache.seed(updated)
    publicAccessData.value = updated
    publicAction.success = 'Public access settings updated.'
  } catch (error) {
    publicAction.error =
      (error as Error & { message?: string }).message || 'Unable to update public access settings.'
  } finally {
    publicAction.saving = false
  }
}

const updatePublicToggle = async (key: PublicAccessToggleField, value: boolean) => {
  await savePublicAccess({ [key]: value })
}

const regeneratePublicSlug = async () => {
  if (!canManagePublic.value || publicAction.regenerating || publicAction.saving) return
  publicAction.error = ''
  publicAction.success = ''
  publicAction.regenerating = true

  try {
    const updated = await publicAccessApi.regenerateSlug(campaignId.value)
    if (!updated) {
      throw new Error('Unable to regenerate public URL.')
    }
    publicCache.seed(updated)
    publicAccessData.value = updated
    publicAction.success = 'Public URL regenerated successfully.'
  } catch (error) {
    publicAction.error =
      (error as Error & { message?: string }).message || 'Unable to regenerate public URL.'
    throw new Error(publicAction.error, { cause: error })
  } finally {
    publicAction.regenerating = false
  }
}

const copyPublicUrl = async () => {
  if (!publicAccessData.value?.publicUrl || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(publicAccessData.value.publicUrl)
    publicAction.success = 'Public URL copied to clipboard.'
    publicAction.error = ''
  } catch {
    publicAction.error = 'Unable to copy public URL.'
  }
}
const transferBaseline = ref('')
watch(transferModalOpen, open => { if (open) transferBaseline.value = JSON.stringify(transferForm) }, { flush: 'sync' })
const transferDirty = computed(() => transferModalOpen.value && JSON.stringify(transferForm) !== transferBaseline.value)
const transferCancel = useTemplateRef('transferCancel')
const focusTransferCancel = (event: Event) => { event.preventDefault(); transferCancel.value?.$el?.focus() }
const publicSections = [
  { key: 'showCharacters', label: 'Characters', icon: 'i-lucide-users' },
  { key: 'showRecaps', label: 'Recaps', icon: 'i-lucide-headphones' },
  { key: 'showSessions', label: 'Sessions', icon: 'i-lucide-scroll-text' },
  { key: 'showGlossary', label: 'Glossary', icon: 'i-lucide-book-open' },
  { key: 'showQuests', label: 'Quests', icon: 'i-lucide-compass' },
  { key: 'showMilestones', label: 'Milestones', icon: 'i-lucide-flag' },
  { key: 'showMaps', label: 'Maps', icon: 'i-lucide-map' },
  { key: 'showJournal', label: 'Journal', icon: 'i-lucide-notebook-pen' },
] as const
const { confirmDiscard: confirmTransferDiscard } = useUnsavedChanges(transferDirty, () => transferModalOpen.value && transferAction.saving)
const transferOpenModel = computed({ get: () => transferModalOpen.value, set: async (open: boolean) => { if (open || await confirmTransferDiscard()) transferModalOpen.value = open } })
</script>


<template>
  <div class="space-y-4">
  <CampaignListTemplate title="Campaign settings">
    <UTabs v-model="activeTab" :items="tabs" :unmount-on-hide="false" variant="link" :ui="{ list: 'grid w-full grid-cols-3 sm:flex sm:w-auto', trigger: 'min-h-11 min-w-0 px-2 sm:px-3', leadingIcon: 'hidden sm:block', label: 'whitespace-normal text-xs sm:text-sm' }">
    <template #general>

    <CampaignSettingsCalendarGeneralSettings :campaign-id="campaignId" :can-edit="canManageCalendar" />

    </template>
    <template #members>
    <section class="space-y-4" aria-label="Membership settings">
      <SharedReadOnlyAlert v-if="!canManageMembers" description="Only the campaign owner can manage members and invitations." />
      <template v-else>
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="type-section flex items-center gap-2"><UIcon name="i-lucide-users" class="size-5 text-primary" aria-hidden="true" /> Members <UBadge v-if="memberData" color="neutral" variant="soft">{{ memberData.members.length }}</UBadge></h2>
              <UButton color="neutral" variant="outline" icon="i-lucide-repeat" :disabled="membersBusy || !transferCandidates.length" @click="openTransferModal">Transfer ownership</UButton>
            </div>
          </template>
          <p v-if="memberAction.success" role="status" class="mb-3 text-sm text-success">{{ memberAction.success }}</p>
          <p v-if="memberAction.error" role="alert" class="mb-3 text-sm text-error">{{ memberAction.error }}</p>
          <SharedResourceState :pending="membersPending" :error="membersError" :has-data="Boolean(memberData)" error-message="Unable to load campaign members." @retry="refreshMembers">
            <div class="divide-y divide-default">
              <div v-for="member in memberData?.members || []" :key="member.id" class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 xl:flex-row xl:items-center xl:justify-between">
                <div class="flex min-w-0 items-center gap-3">
                  <UAvatar :src="member.user.avatarUrl || undefined" :alt="member.user.name" />
                  <div class="min-w-0">
                    <p class="type-record text-highlighted wrap-anywhere">{{ member.user.name }}</p>
                    <p class="text-sm text-muted wrap-anywhere">{{ member.user.email }}</p>
                    <p class="text-xs text-muted">Joined {{ formatDateTime(member.createdAt) }}</p>
                  </div>
                </div>
                <UBadge v-if="member.role === 'OWNER'" color="neutral" variant="subtle" class="self-start">Owner</UBadge>
                <div v-else class="flex flex-wrap items-end gap-3">
                  <UFormField label="Role" :name="'role-' + member.id">
                    <USelect :items="roleOptions" :model-value="member.role" :aria-label="'Role for ' + member.user.name" class="w-40" :disabled="membersBusy" :loading="memberAction.roleSavingMemberId === member.id" @update:model-value="value => updateMemberRole(member.id, value as 'COLLABORATOR' | 'VIEWER')" />
                  </UFormField>
                  <USwitch :model-value="member.hasDmAccess" label="DM access" :aria-label="'DM access for ' + member.user.name" class="min-h-9 items-center" :disabled="membersBusy" :loading="memberAction.dmAccessSavingMemberId === member.id" @update:model-value="value => updateMemberDmAccess(member.id, value)" />
                  <SharedConfirmActionPopover :message="'Remove ' + member.user.name + ' from this campaign? They will lose access and will need a new invitation to rejoin.'" :trigger-aria-label="'Remove ' + member.user.name" trigger-icon="i-lucide-user-minus" :trigger-show-label="false" trigger-size="md" confirm-label="Remove member" :disabled="membersBusy" :action="() => removeMember(member.id)" />
                </div>
              </div>
            </div>
            <p v-if="!transferCandidates.length" class="mt-3 text-xs text-muted">Add another member before transferring ownership.</p>
          </SharedResourceState>
        </UCard>

        <UCard>
          <template #header><h2 class="type-section">Invite a member</h2></template>
          <UForm :state="inviteForm" :schema="inviteSchema" :disabled="membersBusy" class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]" @submit="createInvite">
            <UFormField label="Email" name="email" required><UInput v-model="inviteForm.email" type="email" placeholder="player@example.com" class="w-full" /></UFormField>
            <UFormField label="Role" name="role"><USelect v-model="inviteForm.role" :items="roleOptions" class="w-full" /></UFormField>
            <UButton type="submit" color="primary" variant="solid" icon="i-lucide-user-plus" :loading="inviteAction.saving" :disabled="membersBusy || !inviteSchema.safeParse(inviteForm).success">Create invite</UButton>
          </UForm>
          <p class="mt-3 text-xs text-muted">Collaborators can edit campaign content. Viewers have read-only access. DM access is managed separately.</p>
          <p v-if="inviteAction.success" role="status" class="mt-3 text-sm text-success">{{ inviteAction.success }}</p>
          <p v-if="inviteAction.error" role="alert" class="mt-3 text-sm text-error">{{ inviteAction.error }}</p>
          <UCard v-if="inviteAction.link" variant="soft" class="mt-3">
            <UFormField label="Invitation link"><UInput :model-value="inviteAction.link" readonly class="w-full" /></UFormField>
            <UButton class="mt-2" icon="i-lucide-copy" variant="outline" @click="copyInviteLink">Copy link</UButton>
          </UCard>
        </UCard>

        <UCard variant="soft">
          <template #header><h2 class="type-section">Pending invitations</h2></template>
          <SharedResourceState :pending="membersPending" :error="membersError" :has-data="Boolean(memberData)" :empty="!memberData?.pendingInvites.length" empty-message="No pending invitations." error-message="Unable to load invitations." @retry="refreshMembers">
            <div class="divide-y divide-default">
              <div v-for="invite in memberData?.pendingInvites || []" :key="invite.id" class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div class="min-w-0"><p class="text-sm text-highlighted wrap-anywhere">{{ invite.email }}</p><p class="text-xs text-muted">{{ invite.role === 'COLLABORATOR' ? 'Collaborator' : 'Viewer' }} · Expires {{ formatDateTime(invite.expiresAt) }}</p></div>
                <UBadge color="info" variant="soft">Pending</UBadge>
              </div>
            </div>
          </SharedResourceState>
        </UCard>
      </template>
    </section>

    </template>
    <template #public>
    <section class="space-y-4" aria-label="Public access settings">
      <SharedReadOnlyAlert v-if="!canManagePublic" description="Only the campaign owner can manage public sharing." />
      <SharedResourceState v-else :pending="publicAccessPending" :error="publicAccessError" :has-data="Boolean(publicAccessData)" error-message="Unable to load public access settings." @retry="refreshPublicAccess">
        <template v-if="publicAccessData">
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="type-section flex items-center gap-2"><UIcon name="i-lucide-globe" class="size-5 text-primary" aria-hidden="true" /> Public access</h2>
                <UBadge :color="publicAccessData.isEnabled ? 'info' : 'neutral'" variant="soft">{{ publicAccessData.isEnabled ? 'Public sharing enabled' : 'Private campaign' }}</UBadge>
              </div>
            </template>
            <div class="divide-y divide-default">
              <USwitch :model-value="publicAccessData.isEnabled" label="Enable public access" description="Anyone with the public link can read the sections you enable below." class="pb-4" :disabled="publicAction.saving || publicAction.regenerating" @update:model-value="value => updatePublicToggle('isEnabled', value)" />
              <USwitch :model-value="publicAccessData.isListed" label="List in the public directory" description="Allow this campaign to appear in the directory and homepage. Public access must be enabled first." class="pt-4" :disabled="!publicAccessData.isEnabled || publicAction.saving || publicAction.regenerating" @update:model-value="value => updatePublicToggle('isListed', value)" />
            </div>
          </UCard>
          <UCard>
            <template #header><h2 class="type-section">Shared sections</h2><p class="text-sm text-muted">{{ publicAccessData.isEnabled ? 'Changes save immediately.' : 'Choose what to share when public access is enabled. Nothing is public yet.' }}</p></template>
            <div class="grid gap-x-6 sm:grid-cols-2">
              <div v-for="section in publicSections" :key="section.key" class="flex items-center gap-3 border-b border-default py-4">
                <UIcon :name="section.icon" class="size-5 shrink-0 text-muted" aria-hidden="true" />
                <USwitch :model-value="publicAccessData[section.key]" :label="section.label" :description="section.key === 'showJournal' ? 'Only entries shared with the campaign.' : undefined" :disabled="publicAction.saving || publicAction.regenerating" @update:model-value="value => updatePublicToggle(section.key, value)" />
              </div>
            </div>
          </UCard>
          <UCard variant="soft">
            <UFormField label="Public link"><UInput :model-value="publicAccessData.publicUrl" readonly class="w-full" /></UFormField>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton icon="i-lucide-copy" variant="outline" @click="copyPublicUrl">Copy link</UButton>
              <SharedConfirmActionPopover trigger-label="Regenerate link" trigger-icon="i-lucide-refresh-cw" trigger-variant="outline" trigger-size="md" message="Replace the public link? Existing shared links will stop working." confirm-label="Regenerate link" :disabled="publicAction.saving || publicAction.regenerating" :action="regeneratePublicSlug" />
            </div>
            <p class="mt-3 text-xs text-muted">Updated {{ formatDateTime(publicAccessData.updatedAt) }}</p>
          </UCard>
          <p v-if="publicAction.saving" role="status" class="text-sm text-muted">Saving public access settings…</p>
          <p v-if="publicAction.success" role="status" class="text-sm text-success">{{ publicAction.success }}</p>
          <p v-if="publicAction.error" role="alert" class="text-sm text-error">{{ publicAction.error }}</p>
        </template>
      </SharedResourceState>
    </section>
    </template>
    </UTabs>
  </CampaignListTemplate>

  <UModal v-model:open="transferOpenModel" title="Transfer campaign ownership" description="The selected member becomes the owner immediately. Your role changes to collaborator." :close="false" :dismissible="!transferAction.saving" :content="{ onOpenAutoFocus: focusTransferCancel }">
    <template #body>
      <fieldset :disabled="transferAction.saving" class="space-y-4">
        <UFormField label="New owner" name="newOwner"><USelect v-model="transferForm.targetMemberId" :items="transferMemberOptions" class="w-full" /></UFormField>
        <UFormField label="Your password" name="password"><UInput v-model="transferForm.password" type="password" autocomplete="current-password" class="w-full" /></UFormField>
        <UFormField label="Type TRANSFER to confirm" name="confirmation"><UInput v-model="transferForm.confirmationText" class="w-full" /></UFormField>
        <p v-if="transferAction.error" role="alert" class="text-sm text-error">{{ transferAction.error }}</p>
      </fieldset>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton ref="transferCancel" variant="outline" color="neutral" :disabled="transferAction.saving" @click="transferOpenModel = false">Cancel</UButton>
        <UButton color="error" variant="solid" :disabled="!transferForm.targetMemberId || !transferForm.password || transferForm.confirmationText.trim().toUpperCase() !== 'TRANSFER'" :loading="transferAction.saving" @click="transferOwnership">Transfer ownership</UButton>
      </div>
    </template>
  </UModal>
  </div>
</template>
