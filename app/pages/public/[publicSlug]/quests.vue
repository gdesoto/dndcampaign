<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: quests,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-quests-${publicSlug.value}`,
  () => publicCampaign.getQuests(publicSlug.value)
)

const { questStatusColor } = useCampaignStatusBadges()
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Quests</h2>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Quests are not available for this public campaign.</p>
            <UButton variant="outline" @click="() => refresh()">Try again</UButton>
          </div>

          <div v-else-if="!quests?.length" class="text-sm text-muted">No public quests available.</div>

          <div v-else class="space-y-3">
            <div
              v-for="quest in quests"
              :key="`${quest.title}-${quest.createdAt}`"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold">{{ quest.title }}</p>
                <UBadge :color="questStatusColor(quest.status as any)" variant="soft">{{ quest.status }}</UBadge>
                <UBadge color="neutral" variant="outline">{{ quest.type }}</UBadge>
              </div>
              <p v-if="quest.description" class="mt-1 text-xs text-muted">{{ quest.description }}</p>
              <p v-if="quest.progressNotes" class="mt-1 text-xs text-muted line-clamp-3">{{ quest.progressNotes }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>

