<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})

const slots = useSlots()
const hasAside = computed(() => Boolean(slots.aside))
</script>

<template>
  <div class="min-w-0 space-y-4">
    <CampaignPageHeader
      :title="title"
      :description="description"
    >
      <template #actions>
        <slot name="actions" />
      </template>
    </CampaignPageHeader>

    <div
      :class="hasAside
        ? 'grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]'
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
