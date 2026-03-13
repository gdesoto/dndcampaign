<script setup lang="ts">
type PublicQuest = {
  id: string
  title: string
  description?: string | null
  type: 'CAMPAIGN' | 'GUILD' | 'CHARACTER'
  track: 'MAIN' | 'SIDE'
  sourceType: 'FREE_TEXT' | 'NPC' | 'CAMPAIGN_CHARACTER'
  sourceText?: string | null
  sourceNpcName?: string | null
  sourceCharacterName?: string | null
  reward?: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  progressNotes?: string | null
  expirationDate?: {
    year: number
    month: number
    day: number
  } | null
  createdAt: string
}

const { publicSlug, publicCampaign, overview } = await usePublicCampaignPageContext()

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

const typeLabelMap: Record<PublicQuest['type'], string> = {
  CAMPAIGN: 'Campaign',
  GUILD: 'Guild',
  CHARACTER: 'Character',
}

const trackLabelMap: Record<PublicQuest['track'], string> = {
  MAIN: 'Main quest',
  SIDE: 'Side quest',
}

const statusLabelMap: Record<PublicQuest['status'], string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ON_HOLD: 'On hold',
}

const getSourceLabel = (quest: PublicQuest) => {
  if (quest.sourceType === 'FREE_TEXT') return quest.sourceText || 'Free text'
  if (quest.sourceType === 'NPC') return quest.sourceNpcName || 'NPC'
  return quest.sourceCharacterName || 'Campaign character'
}

const getExpirationLabel = (quest: PublicQuest) => {
  if (!quest.expirationDate) return null
  return `Year ${quest.expirationDate.year}, Month ${quest.expirationDate.month}, Day ${quest.expirationDate.day}`
}
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
              :key="quest.id"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold">{{ quest.title }}</p>
                <UBadge :color="questStatusColor(quest.status as any)" variant="soft">{{ statusLabelMap[quest.status] }}</UBadge>
                <UBadge color="neutral" variant="outline">{{ typeLabelMap[quest.type] }}</UBadge>
                <UBadge color="neutral" variant="soft">{{ trackLabelMap[quest.track] }}</UBadge>
              </div>
              <p v-if="quest.description" class="mt-1 text-xs text-muted">{{ quest.description }}</p>
              <div class="mt-2 grid gap-1 text-xs text-muted md:grid-cols-2">
                <p>Source: {{ getSourceLabel(quest) }}</p>
                <p v-if="quest.reward">Reward: {{ quest.reward }}</p>
                <p v-if="getExpirationLabel(quest)">Expires: {{ getExpirationLabel(quest) }}</p>
              </div>
              <p v-if="quest.progressNotes" class="mt-2 text-xs text-muted line-clamp-3">{{ quest.progressNotes }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>
