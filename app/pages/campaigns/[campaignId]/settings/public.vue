<script setup lang="ts">
import type { CampaignAccess } from '#shared/types/campaign-workflow'
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const campaignAccess = inject<ComputedRef<CampaignAccess | null>>('campaignAccess', computed(() => null))
const canManagePublic = computed(() =>
  Boolean(campaignAccess.value?.permissions.includes('campaign.public.manage'))
)

const publicAccessApi = useCampaignPublicAccess()
const publicCache = useRetainedResource<Awaited<ReturnType<typeof publicAccessApi.getSettings>>>(() => `campaign-public-access-${campaignId.value}`)

const {
  data: publicAccessData,
  pending: publicAccessPending,
  error: publicAccessError,
  refresh: refreshPublicAccess,
} = await useAsyncData(
  () => `campaign-public-access-${campaignId.value}`,
  () => publicCache.load(() => publicAccessApi.getSettings(campaignId.value)),
  { immediate: canManagePublic.value, default: publicCache.get }
)


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
</script>

<template>
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
