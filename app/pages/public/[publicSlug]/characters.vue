<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: characters,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-characters-${publicSlug.value}`,
  () => publicCampaign.getCharacters(publicSlug.value)
)
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Characters</h2>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Characters are not available for this public campaign.</p>
            <UButton variant="outline" @click="refresh">Try again</UButton>
          </div>

          <div v-else-if="!characters?.length" class="text-sm text-muted">No public characters available.</div>

          <div v-else class="space-y-3">
            <div
              v-for="character in characters"
              :key="`${character.name}-${character.roleLabel || ''}`"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">{{ character.name }}</p>
                  <p v-if="character.status" class="text-xs text-muted">{{ character.status }}</p>
                  <p v-if="character.notes" class="mt-1 text-xs text-muted">{{ character.notes }}</p>
                </div>
                <UBadge variant="subtle">{{ character.campaignStatus }}</UBadge>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>
