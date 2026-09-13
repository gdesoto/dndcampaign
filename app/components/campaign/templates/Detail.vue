<script setup lang="ts">
withDefaults(defineProps<{
  backTo: string
  backLabel?: string
  backButtonPlacement?: 'stacked' | 'header'
  backButtonSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  headline?: string
  title: string
  description?: string
}>(), {
  backLabel: 'Back',
  backButtonPlacement: 'header',
  backButtonSize: 'md',
  headline: '',
  description: '',
})

const slots = useSlots()
const hasAside = computed(() => Boolean(slots.aside))
</script>

<template>
  <div class="min-w-0 space-y-4">
    <UButton
      v-if="backButtonPlacement === 'stacked'"
      :size="backButtonSize"
      variant="outline"
      icon="i-lucide-arrow-left"
      :to="backTo"
    >
      {{ backLabel }}
    </UButton>

    <CampaignPageHeader
      :title="title"
      :description="description"
    >
      <template #actions>
        <UButton
          v-if="backButtonPlacement === 'header'"
          :size="backButtonSize"
          variant="outline"
          icon="i-lucide-arrow-left"
          :to="backTo"
        >
          {{ backLabel }}
        </UButton>
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
