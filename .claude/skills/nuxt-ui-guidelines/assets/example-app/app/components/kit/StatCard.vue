<script setup lang="ts">
import type { ProgressGroupItem } from "@nuxt/ui";
/**
 * `icon` names the metric's subject, never its chartness: a generic chart or
 * trend glyph varies with nothing and is decoration. Use icons for every card
 * in a row or none, so no card gains emphasis it has not earned.
 * `tone` colors an exception metric while it is actually an exception.
 * `progress` shows one share of a whole; `segments` shows how a total divides,
 * which is the same question a capacity card answers. Native UProgress and
 * UProgressGroup own both; this card only decides where they sit.
 */
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    icon?: string;
    tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
    delta?: string;
    progress?: number;
    segments?: ProgressGroupItem[];
    max?: number;
  }>(),
  {
    icon: undefined,
    tone: 'neutral',
    delta: undefined,
    progress: undefined,
    segments: undefined,
    max: undefined,
  },
);
const toneText = {
  neutral: { icon: 'text-dimmed', value: 'text-highlighted' },
  success: { icon: 'text-success', value: 'text-success' },
  warning: { icon: 'text-warning', value: 'text-warning' },
  error: { icon: 'text-error', value: 'text-error' },
  info: { icon: 'text-info', value: 'text-info' },
} as const;
</script>
<template>
  <UCard variant="soft">
    <p class="flex items-center gap-1.5 text-xs text-muted">
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-3.5 shrink-0"
        :class="toneText[tone].icon"
      />{{ label }}
    </p>
    <div class="mt-1 flex items-baseline gap-2">
      <p
        class="text-metric font-semibold tabular-nums"
        :class="toneText[tone].value"
      >{{ value }}</p>
      <span v-if="delta" class="text-xs text-muted">{{ delta }}</span>
    </div>
    <UProgress
      v-if="progress !== undefined"
      :model-value="progress"
      :aria-label="label"
      size="xs"
      class="mt-3"
    />
    <UProgressGroup
      v-else-if="segments"
      :items="segments"
      :max="max"
      :aria-label="label"
      size="xs"
      class="mt-3"
    />
    <div v-if="$slots.default" class="mt-3"><slot /></div>
  </UCard>
</template>
