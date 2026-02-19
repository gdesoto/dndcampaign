<script setup lang="ts">
definePageMeta({ layout: 'default' })

type CampaignSummary = {
  id: string
  name: string
  system: string
  description?: string | null
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
            class="group"
          >
            <SharedListItemCard class="group-hover:shadow-lg">
              <template #header>
                <div class="space-y-1">
                  <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ campaign.system }}</p>
                  <h3 class="text-lg font-semibold">{{ campaign.name }}</h3>
                </div>
              </template>
              <p class="text-sm text-default">
                {{ campaign.description || 'No description yet.' }}
              </p>
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

