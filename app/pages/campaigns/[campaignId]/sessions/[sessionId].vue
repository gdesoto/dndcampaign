<script setup lang="ts">
import CampaignDetailTemplate from '~/components/campaign/templates/CampaignDetailTemplate.vue'
import { sessionWorkspaceKey } from '~/composables/useSessionWorkspaceContext'

definePageMeta({
  layout: 'dashboard',
  key: route => `session-${route.params.campaignId}-${route.params.sessionId}`,
})

const route = useRoute()
// This parent is keyed by session. Pin request identities so an outgoing async
// action cannot target the next session while Nuxt switches its suspense tree.
const campaignId = ref(route.params.campaignId as string)
const sessionId = ref(route.params.sessionId as string)
const loadedResource = await useSessionWorkspace({ sessionId })
const workspace = useSessionWorkspaceViewModel({ campaignId, sessionId, resource: loadedResource })
provide(sessionWorkspaceKey, workspace)
const { resource, editor, overview, navigation, summary, jobs } = workspace

useUnsavedChanges(
  () => summary.summaryDirty,
  () => summary.summarySaving || summary.summaryImporting,
  { isWithinScope: to => to.params.campaignId === campaignId.value && to.params.sessionId === sessionId.value },
)

useSeoMeta({
  title: () => {
    if (!resource.session) return `Session details | Campaign ${campaignId.value} | DM Vault`
    const label = resource.session.sessionNumber ? `Session ${resource.session.sessionNumber}` : 'Session'
    return `${label}: ${resource.session.title} | DM Vault`
  },
  description: () => resource.session?.notes?.slice(0, 160)
    || 'Manage recordings, transcript, summary, and recap for this session.',
})
</script>

<template>
  <CampaignDetailTemplate
    :back-to="`/campaigns/${campaignId}/sessions`"
    back-label="Back to sessions"
    back-button-placement="header"
    back-button-size="md"
    headline="Session Workspace"
    :title="resource.session?.title || 'Session details'"
    :description="overview.sessionHeaderDescription"
  >
    <template #actions>
      <UButton
        size="md"
        variant="outline"
        icon="i-lucide-pencil"
        :disabled="!resource.canWriteContent"
        @click="editor.openEditSession"
      >
        Edit session
      </UButton>
    </template>

    <SharedResourceState :pending="resource.pending" :error="resource.error" :has-data="Boolean(resource.session)" :empty="!resource.session" empty-message="This session is unavailable." error-message="Unable to load this session." @retry="resource.refreshWorkspace">
      <SharedReadOnlyAlert
        v-if="!resource.canWriteContent"
        description="Your role can view this session workspace but cannot make changes."
      />
      <div class="space-y-6">
        <SessionWorkflowTimeline
          :items="navigation.sessionNavigationItems"
        />

        <UAlert
          v-if="jobs.error"
          color="error"
          description="Unable to load session jobs. Showing any previously loaded results."
          :actions="[{ label: 'Retry', onClick: () => jobs.refresh().catch(() => {}) }]"
        />
        <NuxtPage />
      </div>
    </SharedResourceState>

    <SessionEditModal
      v-model:open="editor.isEditSessionOpen"
      :form="editor.form"
      :saving="editor.isSaving"
      :error="editor.saveError"
      @update:form="Object.assign(editor.form, $event)"
      @save="editor.saveSession"
    />
  </CampaignDetailTemplate>
</template>
