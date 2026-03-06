<script setup lang="ts">
type QuestType = 'MAIN' | 'SIDE' | 'PLAYER'
type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
type UiColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

type QuestCardItem = {
  id: string
  title: string
  description?: string | null
  type: QuestType
  status: QuestStatus
  progressNotes?: string | null
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
  typeBadgeColor: (type: QuestType) => UiColor
}>()

const emit = defineEmits<{
  edit: [quest: QuestCardItem]
  delete: [quest: QuestCardItem]
  'update-status': [quest: QuestCardItem, status: QuestStatus]
}>()
</script>

<template>
  <SharedListItemCard>
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Quest</p>
          <h3 class="text-lg font-semibold">{{ quest.title }}</h3>
        </div>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="emit('edit', quest)">Edit</UButton>
          <UButton size="xs" color="error" variant="ghost" :disabled="!canWriteContent" @click="emit('delete', quest)">Delete</UButton>
        </div>
      </div>
    </template>

    <p class="text-sm whitespace-pre-line text-default">{{ quest.description || 'Add quest notes.' }}</p>

    <div class="mt-3 flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge :color="typeBadgeColor(quest.type)" variant="soft" size="sm">
          {{ typeLabelMap[quest.type] }}
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

    <div class="mt-3 w-full">
      <p class="text-xs whitespace-pre-line text-muted">{{ quest.progressNotes || 'No progress notes.' }}</p>
    </div>
  </SharedListItemCard>
</template>
