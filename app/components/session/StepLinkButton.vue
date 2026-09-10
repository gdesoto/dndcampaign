<script setup lang="ts">
type SessionStep = 'recordings' | 'transcription' | 'summary' | 'suggestions' | 'recap'

const props = withDefaults(
  defineProps<{
    step: SessionStep
    tooltip?: string
    ariaLabel?: string
  }>(),
  {
    tooltip: '',
    ariaLabel: '',
  }
)

const emit = defineEmits<{
  open: [step: SessionStep]
}>()

const label = computed(() => `Open ${props.step === 'transcription' ? 'transcript' : props.step}`)

const onClick = () => {
  emit('open', props.step)
}
</script>

<template>
  <UTooltip :text="tooltip || label" :content="{ side: 'left' }">
    <UButton
      size="sm"
      variant="ghost"
      icon="i-lucide-square-arrow-out-up-right"
      :aria-label="ariaLabel || label"
      @click="onClick"
    />
  </UTooltip>
</template>
