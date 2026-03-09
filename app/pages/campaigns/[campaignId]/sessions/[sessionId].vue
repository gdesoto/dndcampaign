<script setup lang="ts">
import CampaignDetailTemplate from '~/components/campaign/templates/CampaignDetailTemplate.vue'

definePageMeta({ layout: 'dashboard' })

const {
  campaignId,
  session,
  error,
  canWriteContent,
  currentSection,
  sessionNavigationItems,
  openSessionSection,
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
    headline="Session Workspace"
    :title="session?.title || 'Session details'"
    :description="sessionHeaderDescription"
  >
    <template #actions>
      <UButton
        size="lg"
        variant="outline"
        icon="i-lucide-pencil"
        :disabled="!canWriteContent"
        @click="openEditSession"
      >
        Edit session
      </UButton>
    </template>

    <UCard v-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load this session.</p>
      <UButton class="mt-4" variant="outline" @click="refreshSession">Try again</UButton>
    </UCard>

    <div v-else class="space-y-6">
      <SharedReadOnlyAlert
        v-if="!canWriteContent"
        description="Your role can view this session workspace but cannot make changes."
      />
      <div class="space-y-6">
        <SessionWorkflowTimeline
          :active-step="currentSection"
          :items="sessionNavigationItems"
          @update:active-step="openSessionSection"
          @step-selected="openSessionSection"
        />

        <NuxtPage />
      </div>
    </div>

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

