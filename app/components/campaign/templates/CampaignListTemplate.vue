<script setup lang="ts">
withDefaults(defineProps<{
  headline?: string
  title: string
  description?: string
  count?: number
  actionLabel?: string
  actionIcon?: string
  actionDisabled?: boolean
  actionLoading?: boolean
}>(), {
  headline: '',
  description: '',
  actionLabel: '',
  actionIcon: '',
  actionDisabled: false,
  actionLoading: false,
  count: undefined,
})

const emit = defineEmits<{
  action: []
}>()

const slots = useSlots()
const hasAside = computed(() => Boolean(slots.aside))
</script>

<template>
  <div class="min-w-0 space-y-4">
    <CampaignPageHeader
      :title="title"
      :count="count"
    >
      <template v-if="actionLabel || $slots.actions" #actions>
        <slot name="actions" />
        <UButton
          v-if="actionLabel"
          size="md"
          color="primary"
          variant="solid"
          :icon="actionIcon || undefined"
          :disabled="actionDisabled || actionLoading"
          :loading="actionLoading"
          @click="emit('action')"
        >
          {{ actionLabel }}
        </UButton>
      </template>
    </CampaignPageHeader>

    <slot name="notice" />
    <slot name="filters" />

    <div
      :class="hasAside
        ? 'grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] xl:items-start'
        : 'min-w-0 space-y-4'"
    >
      <div class="min-w-0 space-y-4">
        <slot />
      </div>

      <aside v-if="hasAside" aria-label="Supporting information" class="min-w-0 space-y-4">
        <slot name="aside" />
      </aside>
    </div>
  </div>
</template>
