<script setup lang="ts">
definePageMeta({ layout: 'app' })

const route = useRoute()
const token = computed(() => route.params.token as string)
const membership = useCampaignMembership()
const auth = useAuth()

const validating = ref(false)
const pending = ref(false)
const errorMessage = ref('')
const success = ref<{
  campaignId: string
  campaignName: string
  role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
} | null>(null)
const inviteState = ref<
  | {
      status: 'CAN_ACCEPT'
      role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
      expiresAt: string
    }
  | {
      status: 'ALREADY_MEMBER'
      campaignId: string
      campaignName: string
      role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
    }
  | { status: 'WRONG_ACCOUNT' }
  | { status: 'INVITE_NOT_FOUND' }
  | { status: 'INVITE_EXPIRED' }
  | { status: 'INVITE_ALREADY_PROCESSED' }
  | null
>(null)

const validateInvite = async () => {
  validating.value = true
  errorMessage.value = ''
  success.value = null

  try {
    const result = await membership.inspectInvite(token.value)
    if (!result) {
      throw new Error('Invite response was empty.')
    }
    inviteState.value = result
  } catch (error) {
    errorMessage.value = (error as Error & { message?: string }).message || 'Unable to validate invite link.'
    inviteState.value = null
  } finally {
    validating.value = false
  }
}

onMounted(async () => {
  await validateInvite()
})

const acceptInvite = async () => {
  if (inviteState.value?.status !== 'CAN_ACCEPT') return

  pending.value = true
  errorMessage.value = ''

  try {
    const result = await membership.acceptInvite(token.value)
    if (!result) {
      throw new Error('Invite response was empty.')
    }
    success.value = result
    inviteState.value = {
      status: 'ALREADY_MEMBER',
      campaignId: result.campaignId,
      campaignName: result.campaignName,
      role: result.role,
    }
  } catch (error) {
    errorMessage.value = (error as Error & { message?: string }).message || 'Unable to accept invite.'
    await validateInvite()
  } finally {
    pending.value = false
  }
}

const switchAccount = async () => {
  await auth.logout()
}
</script>

<template>
  <UPage>
    <UPageHeader headline="Campaign Invite" title="Join campaign" />

    <UMain>
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Invite acceptance</h2>
        </template>

        <div class="space-y-4">
          <p v-if="inviteState?.status !== 'ALREADY_MEMBER'" class="text-sm text-muted">
            Accept this invite to join the campaign with the role defined by the campaign owner.
          </p>

          <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>

          <div v-if="validating" class="space-y-2">
            <p class="text-sm text-muted">Validating invite link...</p>
          </div>

          <div v-else-if="success" class="space-y-2">
            <p class="text-sm text-success">
              You joined <span class="font-semibold">{{ success.campaignName }}</span> as {{ success.role }}.
            </p>
            <UButton :to="`/campaigns/${success.campaignId}`">Open campaign</UButton>
          </div>

          <div v-else-if="inviteState?.status === 'ALREADY_MEMBER'" class="space-y-2">
            <p class="text-sm text-success">
              You already have access to <span class="font-semibold">{{ inviteState.campaignName }}</span> as {{ inviteState.role }}.
            </p>
            <UButton :to="`/campaigns/${inviteState.campaignId}`">Open campaign</UButton>
          </div>

          <div v-else-if="inviteState?.status === 'WRONG_ACCOUNT'" class="space-y-2">
            <UAlert
              color="warning"
              variant="subtle"
              title="Wrong account for this invite"
              description="This invite was sent to a different account. Sign out and sign back in with the invited email."
            />
            <UButton variant="outline" @click="switchAccount">Switch account</UButton>
          </div>

          <div v-else-if="inviteState?.status === 'INVITE_NOT_FOUND'" class="space-y-2">
            <UAlert
              color="error"
              variant="subtle"
              title="Invite link not found"
              description="This invitation link is invalid or no longer available."
            />
          </div>

          <div v-else-if="inviteState?.status === 'INVITE_EXPIRED'" class="space-y-2">
            <UAlert
              color="error"
              variant="subtle"
              title="Invite expired"
              description="This invitation link has expired. Ask the campaign owner to send a new invite."
            />
          </div>

          <div v-else-if="inviteState?.status === 'INVITE_ALREADY_PROCESSED'" class="space-y-2">
            <UAlert
              color="warning"
              variant="subtle"
              title="Invite already used"
              description="This invitation link has already been accepted, revoked, or otherwise processed."
            />
          </div>

          <UButton
            v-else-if="inviteState?.status === 'CAN_ACCEPT'"
            :loading="pending"
            @click="acceptInvite"
          >
            Accept invite
          </UButton>

          <UButton v-else variant="outline" :loading="validating" @click="validateInvite">Retry validation</UButton>
        </div>
      </UCard>
    </UMain>
  </UPage>
</template>
