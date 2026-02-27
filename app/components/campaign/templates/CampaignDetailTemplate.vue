<script setup lang="ts">
withDefaults(defineProps<{
  backTo: string
  backLabel?: string
  headline?: string
  title: string
  description?: string
}>(), {
  backLabel: 'Back',
  headline: '',
  description: '',
})

const slots = useSlots()
const hasAside = computed(() => Boolean(slots.aside))
</script>

<template>
  <div class="space-y-6">
    <UButton
      variant="outline"
      icon="i-lucide-arrow-left"
      :to="backTo"
    >
      {{ backLabel }}
    </UButton>

    <UPageHeader
      :headline="headline"
      :title="title"
      :description="description"
    >
      <template #right>
        <slot name="actions" />
      </template>
    </UPageHeader>

    <div
      :class="hasAside
        ? 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]'
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

