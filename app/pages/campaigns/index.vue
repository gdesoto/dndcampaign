<script setup lang="ts">
definePageMeta({ layout: 'default' })

type CampaignSummary = {
  id: string
  name: string
  system: string
  description?: string | null
  dungeonMasterName?: string | null
  currentStatus?: string | null
  updatedAt: string
}

const { request } = useApi()

const { data: campaigns, pending, refresh, error } = await useAsyncData(
  'campaigns',
  () => request<CampaignSummary[]>('/api/campaigns')
)

const isCreateOpen = ref(false)
const createForm = reactive({
  name: '',
  system: '',
  description: '',
})
const createError = ref('')
const isCreating = ref(false)

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))

const systemLabelFor = (campaign: CampaignSummary) => campaign.system || 'Custom System'
const dmLabelFor = (campaign: CampaignSummary) => campaign.dungeonMasterName || 'Unassigned'

const openCreate = () => {
  createError.value = ''
  createForm.name = ''
  createForm.system = ''
  createForm.description = ''
  isCreateOpen.value = true
}

const createCampaign = async () => {
  createError.value = ''
  isCreating.value = true
  try {
    const created = await request<CampaignSummary>('/api/campaigns', {
      method: 'POST',
      body: {
        name: createForm.name,
        system: createForm.system || undefined,
        description: createForm.description || undefined,
      },
    })
    if (!created) {
      throw new Error('Unable to create campaign.')
    }
    isCreateOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${created.id}`)
  } catch (error) {
    createError.value =
      (error as Error & { message?: string }).message || 'Unable to create campaign.'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <UPage>
    <div class="space-y-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Your world</p>
          <h1 class="mt-2 text-2xl font-semibold">Campaigns</h1>
        </div>
        <UButton size="lg" @click="openCreate">New campaign</UButton>
      </div>

      <SharedResourceState
        :pending="pending"
        :error="error"
        :empty="!campaigns?.length"
        error-message="Unable to load campaigns."
        empty-message="No campaigns yet."
        @retry="refresh"
      >
        <template #loading>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <UCard v-for="i in 3" :key="i" class="h-36 animate-pulse" />
          </div>
        </template>
        <template #emptyActions>
          <UButton variant="outline" @click="openCreate">Create your first campaign</UButton>
        </template>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <NuxtLink
            v-for="campaign in campaigns"
            :key="campaign.id"
            :to="`/campaigns/${campaign.id}`"
            class="group block h-full"
          >
            <SharedListItemCard
              class="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg"
              :ui="{
                root: 'h-full overflow-hidden',
                header: 'before:block before:h-[4px] before:bg-gradient-to-r before:from-primary-700 before:via-primary-500 before:to-primary-700',
                body: 'space-y-4',
              }"
            >
              <template #header>
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <p class="font-display text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-dimmed)]">
                      {{ systemLabelFor(campaign) }}
                    </p>
                    <h3 class="font-display text-lg uppercase tracking-[0.02em] text-[var(--ui-text-highlighted)]">
                      {{ campaign.name }}
                    </h3>
                  </div>
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="mt-0.5 size-4 text-[var(--ui-text-dimmed)] transition-colors group-hover:text-primary-500"
                  />
                </div>
              </template>
              <p class="line-clamp-3 min-h-[4.5rem] text-sm text-[var(--ui-text-muted)]">
                {{ campaign.description || 'No description yet.' }}
              </p>
              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ui-border)] pt-3">
                <UBadge color="primary" variant="outline">DM: {{ dmLabelFor(campaign) }}</UBadge>
                <p class="text-xs text-[var(--ui-text-dimmed)]">
                  Updated {{ formatUpdatedAt(campaign.updatedAt) }}
                </p>
              </div>
            </SharedListItemCard>
          </NuxtLink>
        </div>
      </SharedResourceState>

      <SharedEntityFormModal
        v-model:open="isCreateOpen"
        title="Create campaign"
        :saving="isCreating"
        :error="createError"
        submit-label="Create"
        @submit="createCampaign"
      >
        <UFormField label="Name" name="name">
          <UInput v-model="createForm.name" placeholder="The Ashen Vale" />
        </UFormField>
        <UFormField label="System" name="system">
          <UInput v-model="createForm.system" placeholder="D&D 5e" />
        </UFormField>
        <UFormField label="Description" name="description">
          <UTextarea v-model="createForm.description" :rows="4" placeholder="Short campaign pitch..." />
        </UFormField>
      </SharedEntityFormModal>
    </div>
  </UPage>
</template>

