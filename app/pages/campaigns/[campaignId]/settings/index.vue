<script setup lang="ts">
import type { CampaignOverviewDetail } from '#shared/types/campaign-overview'
import type { CampaignAccess } from '#shared/types/campaign-workflow'
import { namedEntityFormSchema } from '~/utils/entity-form-schemas'
definePageMeta({ layout: 'dashboard' })

const { campaignId, request } = useCampaignPageContext()
const campaignAccess = inject<ComputedRef<CampaignAccess | null>>('campaignAccess', computed(() => null))
// Matches the permission PATCH /api/campaigns/:campaignId requires.
const canEdit = computed(() => Boolean(campaignAccess.value?.permissions.includes('campaign.settings.manage')))
// Shares the overview's request key so a save keeps the overview current too.
const { data: campaign, pending, error, refresh } = await useOverviewResource<CampaignOverviewDetail>(campaignId, 'campaign', () => `/api/campaigns/${campaignId.value}`)

const form = reactive({ name: '', system: '', dungeonMasterName: '', description: '' })
const draft = useEditorDraft(() => ({ ...form }), value => { Object.assign(form, value) })
watch(campaign, value => {
  if (value) draft.sync({ name: value.name, system: value.system, dungeonMasterName: value.dungeonMasterName || '', description: value.description || '' }, value.id)
}, { immediate: true })
const saving = ref(false)
const saveError = ref('')
const toast = useToast()
useUnsavedChanges(draft.dirty, saving)

const save = async () => {
  if (!canEdit.value || saving.value || !draft.dirty.value) return
  const submitted = draft.snapshot()
  saveError.value = ''
  saving.value = true
  try {
    await request(`/api/campaigns/${campaignId.value}`, { method: 'PATCH', body: submitted })
    draft.accept(submitted)
    await Promise.all([refresh(), refreshNuxtData([`dashboard-campaign-shell-${campaignId.value}`, `campaign-workspace-${campaignId.value}-none`])])
    toast.add({ title: 'Campaign saved', color: 'success' })
  } catch (cause) {
    saveError.value = (cause as Error).message || 'Unable to update campaign.'
  } finally { saving.value = false }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="type-section flex items-center gap-2"><UIcon name="i-lucide-scroll-text" class="size-5 text-primary" aria-hidden="true" /> Campaign details</h2>
        <UBadge v-if="draft.dirty.value" color="neutral" variant="subtle">Unsaved changes</UBadge>
      </div>
    </template>
    <SharedResourceState :pending="pending" :error="error" :has-data="Boolean(campaign)" error-message="Unable to load campaign details." @retry="refresh">
      <SharedReadOnlyAlert v-if="!canEdit" class="mb-4" description="Only the campaign owner can edit campaign details." />
      <UForm :state="form" :schema="namedEntityFormSchema" :disabled="!canEdit || saving" class="space-y-4" @submit="save">
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Name" name="name" required><UInput v-model="form.name" class="w-full" /></UFormField>
          <UFormField label="System" name="system"><UInput v-model="form.system" class="w-full" /></UFormField>
          <UFormField label="Dungeon master" name="dungeonMasterName"><UInput v-model="form.dungeonMasterName" placeholder="DM name" class="w-full" /></UFormField>
        </div>
        <UFormField label="Description" name="description"><UTextarea v-model="form.description" :rows="5" class="w-full" /></UFormField>
        <div v-if="canEdit" class="flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite"><p v-if="saveError" role="alert" class="text-sm text-error">{{ saveError }}</p><p v-else class="text-sm text-muted">{{ draft.dirty.value ? 'Your changes are ready to save.' : 'Campaign details are up to date.' }}</p></div>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" :disabled="saving || !draft.dirty.value" @click="draft.discard()">Discard changes</UButton>
            <UButton type="submit" color="primary" variant="solid" icon="i-lucide-save" :disabled="!draft.dirty.value" :loading="saving">Save changes</UButton>
          </div>
        </div>
      </UForm>
    </SharedResourceState>
  </UCard>
</template>
