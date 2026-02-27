<script setup lang="ts">
withDefaults(defineProps<{
  headline?: string
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
  actionDisabled?: boolean
}>(), {
  headline: '',
  description: '',
  actionLabel: '',
  actionIcon: '',
  actionDisabled: false,
})

const emit = defineEmits<{
  action: []
}>()

const slots = useSlots()
const hasAside = computed(() => Boolean(slots.aside))
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      :headline="headline"
      :title="title"
      :description="description"
    >
      <template #links>
        <div class="flex items-center gap-2">
          <slot name="actions" />
          <UButton
            v-if="actionLabel"
            size="lg"
            :icon="actionIcon || undefined"
            :disabled="actionDisabled"
            @click="emit('action')"
          >
            {{ actionLabel }}
          </UButton>
        </div>
      </template>
    </UPageHeader>

    <slot name="notice" />
    <slot name="filters" />

    <div
      :class="hasAside
        ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start'
        : 'space-y-6'"
    >
      <div class="space-y-6">
        <slot />
      </div>

      <div v-if="hasAside" class="space-y-6">
        <slot name="aside" />
      </div>
    </div>
  </div>
</template>
