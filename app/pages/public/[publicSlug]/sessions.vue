<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: sessions,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-sessions-${publicSlug.value}`,
  () => publicCampaign.getSessions(publicSlug.value)
)

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'Unscheduled')
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Sessions</h2>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Sessions are not available for this public campaign.</p>
            <UButton variant="outline" @click="() => refresh()">Try again</UButton>
          </div>

          <div v-else-if="!sessions?.length" class="text-sm text-muted">No public sessions available.</div>

          <div v-else class="space-y-3">
            <div
              v-for="session in sessions"
              :key="`${session.title}-${session.createdAt}`"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <p class="text-sm font-semibold">Session #{{ session.sessionNumber || '?' }} · {{ session.title }}</p>
              <p class="text-xs text-muted">{{ formatDate(session.playedAt) }}</p>
              <p v-if="session.notes" class="mt-1 text-xs text-muted line-clamp-3">{{ session.notes }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>

