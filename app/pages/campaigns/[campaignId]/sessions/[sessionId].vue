<script setup lang="ts">
import CampaignDetailTemplate from '~/components/campaign/templates/CampaignDetailTemplate.vue'

definePageMeta({ layout: 'dashboard' })

const {
  campaignId,
  session,
  error,
  pending,
  canWriteContent,
  sessionNavigationItems,
  openEditSession,
  refreshSession,
  sessionHeaderDescription,
  isEditSessionOpen,
  form,
  isSaving,
  saveError,
  saveSession,
} = await useSessionWorkspaceViewModel()

useSeoMeta({
  title: () => {
    if (!session.value) return `Session details | Campaign ${campaignId.value} | DM Vault`
    const label = session.value.sessionNumber
      ? `Session ${session.value.sessionNumber}`
      : 'Session'
    return `${label}: ${session.value.title} | DM Vault`
  },
  description: () => {
    if (!session.value?.notes) return 'Manage recordings, transcript, summary, and recap for this session.'
    return session.value.notes.slice(0, 160)
  },
})
</script>

<template>
  <CampaignDetailTemplate
    :back-to="`/campaigns/${campaignId}/sessions`"
    back-label="Back to sessions"
    back-button-placement="header"
    back-button-size="md"
    headline="Session Workspace"
    :title="session?.title || 'Session details'"
    :description="sessionHeaderDescription"
  >
    <template #actions>
      <UButton
        size="md"
        variant="outline"
        icon="i-lucide-pencil"
        :disabled="!canWriteContent"
        @click="openEditSession"
      >
        Edit session
      </UButton>
    </template>

    <SharedResourceState :pending="pending" :error="error" :has-data="Boolean(session)" :empty="!session" empty-message="This session is unavailable." error-message="Unable to load this session." @retry="refreshSession">
      <SharedReadOnlyAlert
        v-if="!canWriteContent"
        description="Your role can view this session workspace but cannot make changes."
      />
      <div class="space-y-6">
        <SessionWorkflowTimeline
          :items="sessionNavigationItems"
        />

        <NuxtPage />
      </div>
    </SharedResourceState>

    <SessionEditModal
      v-model:open="isEditSessionOpen"
      :form="form"
      :saving="isSaving"
      :error="saveError"
      @update:form="Object.assign(form, $event)"
      @save="saveSession"
    />
  </CampaignDetailTemplate>
</template>
