<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: milestones,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-milestones-${publicSlug.value}`,
  () => publicCampaign.getMilestones(publicSlug.value)
)

const { milestoneStatusColor } = useCampaignStatusBadges()
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Milestones</h2>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Milestones are not available for this public campaign.</p>
            <UButton variant="outline" @click="() => refresh()">Try again</UButton>
          </div>

          <div v-else-if="!milestones?.length" class="text-sm text-muted">No public milestones available.</div>

          <div v-else class="space-y-3">
            <div
              v-for="milestone in milestones"
              :key="`${milestone.title}-${milestone.createdAt}`"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold">{{ milestone.title }}</p>
                <UBadge :color="milestoneStatusColor(milestone.isComplete)" variant="soft">
                  {{ milestone.isComplete ? 'Complete' : 'Open' }}
                </UBadge>
              </div>
              <p v-if="milestone.description" class="mt-1 text-xs text-muted">{{ milestone.description }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>

