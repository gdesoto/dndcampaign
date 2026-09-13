<script setup lang="ts">
import { useRouter } from 'vue-router';
import { canNavigateRow } from './rowNavigation';
const props = defineProps<{
  title: string;
  description?: string;
  to?: string;
  rowClickable?: boolean;
  selected?: boolean;
  selectable?: boolean;
  expanded?: boolean;
  expandable?: boolean;
  variant?: "row" | "card";
}>();
const router = useRouter();
function openRow(event: MouseEvent) {
  if (props.rowClickable && props.to && canNavigateRow(event, window.getSelection()?.toString())) void router.push(props.to);
}
defineEmits<{
  "update:selected": [value: boolean];
  "update:expanded": [value: boolean];
}>();
</script>
<template>
  <div :class="variant === 'card' ? 'rounded-lg border border-default bg-default px-3' : 'border-b border-default last:border-b-0'">
    <div class="flex items-start gap-2 py-2 sm:gap-3" :class="{ 'cursor-pointer hover:bg-muted/40': rowClickable && to }" @click="openRow">
      <UCheckbox
        v-if="selectable"
        :model-value="selected"
        :aria-label="'Select ' + title"
        class="mt-1"
        @update:model-value="$emit('update:selected', $event === true)"
      />
      <slot name="leading" />
      <div class="min-w-0 flex-1">
        <NuxtLink
          v-if="to"
          :to="to"
          class="text-data font-semibold text-highlighted hover:text-primary focus-visible:outline-2"
          >{{ title }}</NuxtLink
        >
        <p v-else class="text-data font-semibold text-highlighted">{{ title }}</p>
        <p v-if="description" class="mt-1 text-sm text-muted break-words" :class="{ 'line-clamp-2': expandable && !expanded }">
          {{ description }}
        </p>
        <div
          v-if="$slots.metadata"
          class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"
        >
          <slot name="metadata" />
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <UTooltip v-if="expandable" :text="expanded ? 'Collapse details' : 'Expand details'"><UButton
          :icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :aria-label="(expanded ? 'Collapse ' : 'Expand ') + title"
          :aria-expanded="expanded"
          color="neutral"
          variant="ghost"
          @click="$emit('update:expanded', !expanded)"
        /></UTooltip>
        <slot name="actions" />
      </div>
    </div>
    <div v-if="expanded" class="pb-4 text-sm"><slot name="expanded" /></div>
  </div>
</template>
