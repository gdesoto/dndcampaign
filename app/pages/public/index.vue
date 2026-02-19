<script setup lang="ts">
const publicCampaign = usePublicCampaign()
const search = ref('')
const debouncedSearch = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = value.trim()
  }, 250)
})

const {
  data: campaigns,
  pending,
  refresh,
} = await useAsyncData(
  () => `public-campaign-directory-${debouncedSearch.value || 'all'}`,
  () => publicCampaign.listCampaigns({ search: debouncedSearch.value, limit: 48 }),
  { watch: [debouncedSearch] }
)
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <UCard>
          <div class="space-y-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Public Directory</p>
              <h1 class="mt-2 text-2xl font-semibold">Discover public campaigns</h1>
              <p class="text-sm text-muted">
                Browse campaigns that owners chose to list publicly.
              </p>
            </div>
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Search by campaign name, system, or DM"
            />
          </div>
        </UCard>

        <PublicCampaignDirectoryList
          title="Directory results"
          :campaigns="campaigns"
          :loading="pending"
          empty-message="No listed public campaigns match your search."
        />

        <div class="flex justify-end">
          <UButton variant="outline" @click="() => refresh()">Refresh</UButton>
        </div>
      </div>
    </UPage>
  </UMain>
</template>

