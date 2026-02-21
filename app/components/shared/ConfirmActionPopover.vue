<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  cancelColor?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  confirmVariant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  cancelVariant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  confirmSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  cancelSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  confirmIcon?: string
  confirmLoading?: boolean
  disabled?: boolean
  contentClass?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  triggerLabel?: string
  triggerAriaLabel?: string
  triggerColor?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  triggerVariant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  triggerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  triggerIcon?: string
  triggerShowLabel?: boolean
}>(), {
  message: 'Are you sure?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  confirmColor: 'error',
  cancelColor: 'neutral',
  confirmVariant: 'solid',
  cancelVariant: 'ghost',
  confirmSize: 'xs',
  cancelSize: 'xs',
  confirmIcon: '',
  confirmLoading: false,
  disabled: false,
  contentClass: 'w-56 p-3',
  side: 'top',
  align: 'end',
  triggerLabel: 'Remove',
  triggerAriaLabel: 'Confirm action',
  triggerColor: 'error',
  triggerVariant: 'ghost',
  triggerSize: 'xs',
  triggerIcon: '',
  triggerShowLabel: true,
})

const emit = defineEmits<{
  cancel: []
  confirm: [{ close: () => void }]
}>()
</script>

<template>
  <UPopover :content="{ side, align }" :ui="{ content: contentClass }">
    <slot name="trigger">
      <UButton
        :size="triggerSize"
        :color="triggerColor"
        :variant="triggerVariant"
        :icon="triggerIcon || undefined"
        :aria-label="triggerAriaLabel"
        :disabled="disabled"
      >
        <template v-if="triggerShowLabel">
          {{ triggerLabel }}
        </template>
      </UButton>
    </slot>

    <template #content="{ close }">
      <div class="space-y-3">
        <slot name="content">
          <p class="text-sm text-muted">{{ message }}</p>
        </slot>
        <div class="flex justify-end gap-2">
          <UButton :size="cancelSize" :variant="cancelVariant" :color="cancelColor" @click="emit('cancel'); close()">
            {{ cancelLabel }}
          </UButton>
          <UButton
            :size="confirmSize"
            :variant="confirmVariant"
            :color="confirmColor"
            :icon="confirmIcon || undefined"
            :loading="confirmLoading"
            @click="emit('confirm', { close })"
          >
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
