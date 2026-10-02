<script setup lang="ts">
type SessionStep = 'recordings' | 'transcription' | 'summary' | 'suggestions' | 'recap'

const props = withDefaults(
  defineProps<{
    step: SessionStep
    to: string
    tooltip?: string
    ariaLabel?: string
  }>(),
  {
    tooltip: '',
    ariaLabel: '',
  }
)

const label = computed(() => `Open ${props.step === 'transcription' ? 'transcript' : props.step}`)
</script>

<template>
  <UTooltip :text="tooltip || label" :content="{ side: 'left' }">
    <UButton
      size="sm"
      variant="ghost"
      icon="i-lucide-square-arrow-out-up-right"
      :aria-label="ariaLabel || label"
      :to="to"
    />
  </UTooltip>
</template>
