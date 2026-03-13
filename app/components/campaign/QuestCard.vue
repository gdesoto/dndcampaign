<script setup lang="ts">
type QuestType = 'CAMPAIGN' | 'GUILD' | 'CHARACTER'
type QuestTrack = 'MAIN' | 'SIDE'
type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
type QuestSourceType = 'FREE_TEXT' | 'NPC' | 'CAMPAIGN_CHARACTER'
type UiColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

type QuestCardItem = {
  id: string
  campaignId?: string
  title: string
  description?: string | null
  type: QuestType
  track: QuestTrack
  sourceType: QuestSourceType
  sourceText?: string | null
  sourceNpcId?: string | null
  sourceNpcName?: string | null
  sourceCharacterId?: string | null
  sourceCharacterName?: string | null
  reward?: string | null
  status: QuestStatus
  progressNotes?: string | null
  expirationDate?: {
    year: number
    month: number
    day: number
  } | null
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

type QuestStatusOption = {
  label: string
  value: QuestStatus
}

defineProps<{
  quest: QuestCardItem
  canWriteContent: boolean
  statusOptions: QuestStatusOption[]
  statusLabelMap: Record<QuestStatus, string>
  typeLabelMap: Record<QuestType, string>
  trackLabelMap: Record<QuestTrack, string>
  typeBadgeColor: (type: QuestType) => UiColor
  trackBadgeColor: (track: QuestTrack) => UiColor
  getSourceLabel: (quest: QuestCardItem) => string
  getExpirationLabel: (quest: QuestCardItem) => string | null
}>()

const emit = defineEmits<{
  edit: [quest: QuestCardItem]
  'update-status': [quest: QuestCardItem, status: QuestStatus]
}>()
</script>

<template>
  <SharedListItemCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Quest</p>
          <h3 class="text-lg font-semibold">{{ quest.title }}</h3>
        </div>
        <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="emit('edit', quest)">Edit</UButton>
      </div>
    </template>

    <p class="text-sm whitespace-pre-line text-default">{{ quest.description || 'Add quest notes.' }}</p>

    <div class="mt-3 flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge :color="typeBadgeColor(quest.type)" variant="soft" size="sm">
          {{ typeLabelMap[quest.type] }}
        </UBadge>
        <UBadge :color="trackBadgeColor(quest.track)" variant="soft" size="sm">
          {{ trackLabelMap[quest.track] }}
        </UBadge>
        <UBadge color="neutral" variant="soft" size="sm">
          {{ statusLabelMap[quest.status] }}
        </UBadge>
      </div>
      <USelect
        class="w-full sm:w-44"
        :disabled="!canWriteContent"
        :items="statusOptions"
        :model-value="quest.status"
        @update:model-value="(value) => emit('update-status', quest, value as QuestStatus)"
      />
    </div>

    <div class="mt-3 grid gap-2 text-xs text-muted md:grid-cols-2">
      <p><span class="text-dimmed">Source:</span> {{ getSourceLabel(quest) }}</p>
      <p v-if="quest.reward"><span class="text-dimmed">Reward:</span> {{ quest.reward }}</p>
      <p v-if="getExpirationLabel(quest)"><span class="text-dimmed">Expires:</span> {{ getExpirationLabel(quest) }}</p>
    </div>

    <div class="mt-3 w-full">
      <p class="text-xs whitespace-pre-line text-muted">{{ quest.progressNotes || 'No progress notes.' }}</p>
    </div>
  </SharedListItemCard>
</template>
