<script setup lang="ts">
definePageMeta({ layout: 'app' })

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

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UCard v-for="i in 3" :key="i"  class="h-36 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load campaigns.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <UCard v-else-if="!campaigns?.length" class="text-center">
      <p class="text-sm text-muted">No campaigns yet.</p>
      <UButton class="mt-4" variant="outline" @click="openCreate">Create your first campaign</UButton>
    </UCard>

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="campaign in campaigns"
        :key="campaign.id"
        :to="`/campaigns/${campaign.id}`"
        class="group"
      >
        <UCard  class="transition group-hover:shadow-lg">
          <template #header>
            <div class="space-y-1">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ campaign.system }}</p>
              <h3 class="text-lg font-semibold">{{ campaign.name }}</h3>
            </div>
          </template>
          <p class="text-sm text-default">
            {{ campaign.description || 'No description yet.' }}
          </p>
        </UCard>
      </NuxtLink>
    </div>

    <UModal v-model:open="isCreateOpen">
      <template #content>
        <UCard >
          <template #header>
            <h2 class="text-lg font-semibold">Create campaign</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-default">Name</label>
              <UInput v-model="createForm.name" placeholder="The Ashen Vale" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">System</label>
              <UInput v-model="createForm.system" placeholder="D&D 5e" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-default">Description</label>
              <UTextarea v-model="createForm.description" :rows="4" placeholder="Short campaign pitch..." />
            </div>
            <p v-if="createError" class="text-sm text-error">{{ createError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isCreateOpen = false">Cancel</UButton>
              <UButton :loading="isCreating" @click="createCampaign">Create</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
    </div>
  </UPage>
</template>


