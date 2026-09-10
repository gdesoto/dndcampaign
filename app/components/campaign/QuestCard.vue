<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
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

const props = defineProps<{
  deleteAction?: () => Promise<unknown>
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
const statusColors = {
  ACTIVE: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
} as const
const statusClasses = {
  ACTIVE: 'text-info bg-info/10 hover:bg-info/20 focus:bg-info/20',
  ON_HOLD: 'text-warning bg-warning/10 hover:bg-warning/20 focus:bg-warning/20',
  COMPLETED: 'text-success bg-success/10 hover:bg-success/20 focus:bg-success/20',
  FAILED: 'text-error bg-error/10 hover:bg-error/20 focus:bg-error/20',
} as const
const typeIcons = {
  CAMPAIGN: 'i-lucide-book-open',
  GUILD: 'i-lucide-shield',
  CHARACTER: 'i-lucide-user-round',
} as const
const metadataTags = computed(() => [
  { label: props.typeLabelMap[props.quest.type], icon: typeIcons[props.quest.type], class: 'bg-violet-500/10 text-violet-800 dark:text-violet-200' },
  { label: props.trackLabelMap[props.quest.track], icon: props.quest.track === 'MAIN' ? 'i-lucide-route' : 'i-lucide-signpost', class: 'bg-primary/15 text-primary-700 dark:text-primary-200' },
])
const actions = computed<RecordAction[]>(() => props.canWriteContent ? [
  { label: 'Edit', icon: 'i-lucide-pencil', action: () => emit('edit', props.quest) },
  ...(props.deleteAction ? [{ label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: props.deleteAction, confirmation: { message: `Delete quest "${props.quest.title}"? This cannot be undone.` } }] : []),
] : [])

</script>

<template>
  <SharedListItemCard>
    <template #header>
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 flex-1 items-start gap-2">
          <UIcon name="i-lucide-scroll-text" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <h3 class="type-record break-words">{{ quest.title }}</h3>
        </div>
        <USelect
          v-if="canWriteContent"
          class="shrink-0"
          :class="statusClasses[quest.status]"
          size="sm"
          variant="soft"
          :color="statusColors[quest.status]"
          :aria-label="`Status for ${quest.title}`"
          :items="statusOptions"
          :model-value="quest.status"
          @update:model-value="(value) => emit('update-status', quest, value as QuestStatus)"
        />
        <UBadge v-else :color="statusColors[quest.status]" variant="soft" size="sm" class="shrink-0">
          {{ statusLabelMap[quest.status] }}
        </UBadge>
        <SharedActionMenu :name="quest.title" :items="actions" />
      </div>
    </template>

    <div class="flex flex-wrap items-center gap-2" aria-label="Quest category and track">
      <UBadge
        v-for="tag in metadataTags"
        :key="tag.label"
        color="neutral"
        variant="soft"
        size="sm"
        class="gap-1.5 rounded-full px-2.5 py-1"
        :class="tag.class"
      >
        <span class="flex items-center">
          <UIcon :name="tag.icon" class="size-3.5 shrink-0" aria-hidden="true" />
        </span>
        {{ tag.label }}
      </UBadge>
    </div>

    <p v-if="quest.description" class="reading-copy mt-3 whitespace-pre-line text-default">{{ quest.description }}</p>

    <div class="mt-3 grid gap-2 text-xs text-muted md:grid-cols-2">
      <p class="flex items-start gap-2"><UIcon name="i-lucide-user" class="size-4 shrink-0" aria-hidden="true" /><span>Source: {{ getSourceLabel(quest) }}</span></p>
      <p v-if="quest.reward" class="flex items-start gap-2"><UIcon name="i-lucide-gift" class="size-4 shrink-0" aria-hidden="true" /><span>Reward: {{ quest.reward }}</span></p>
      <p v-if="getExpirationLabel(quest)" class="flex items-start gap-2"><UIcon name="i-lucide-calendar-clock" class="size-4 shrink-0" aria-hidden="true" /><span>Expires: {{ getExpirationLabel(quest) }}</span></p>
    </div>

    <div v-if="quest.progressNotes" class="mt-3 w-full border-t border-muted pt-3">
      <p class="text-sm whitespace-pre-line text-muted">{{ quest.progressNotes }}</p>
    </div>
  </SharedListItemCard>
</template>
