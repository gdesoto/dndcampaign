<script setup lang="ts">
type SessionStep = 'recordings' | 'transcription' | 'summary' | 'suggestions' | 'recap'

const props = withDefaults(
  defineProps<{
    step: SessionStep
    tooltip?: string
    ariaLabel?: string
  }>(),
  {
    tooltip: 'Open step',
    ariaLabel: 'Open step',
  }
)

const emit = defineEmits<{
  open: [step: SessionStep]
}>()

const onClick = () => {
  emit('open', props.step)
}
</script>

<template>
  <UTooltip :text="tooltip" :content="{ side: 'left' }">
    <UButton
      size="xs"
      variant="ghost"
      icon="i-lucide-square-arrow-out-up-right"
      :aria-label="ariaLabel"
      @click="onClick"
    />
  </UTooltip>
</template>
