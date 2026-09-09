<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'

const [DefineContent, ReuseContent] = createReusableTemplate<{ controls: { close: () => void } }>()
const props = withDefaults(defineProps<{
  reference?: HTMLElement
  hideTrigger?: boolean
  modal?: boolean
  focusFallback?: () => void
  action?: () => Promise<unknown>
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
  reference: undefined,
  hideTrigger: false,
  modal: false,
  action: undefined,
  focusFallback: undefined,
  message: 'Are you sure?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  confirmColor: 'error',
  cancelColor: 'neutral',
  confirmVariant: 'solid',
  cancelVariant: 'ghost',
  confirmSize: 'sm',
  cancelSize: 'sm',
  confirmIcon: '',
  confirmLoading: false,
  disabled: false,
  contentClass: 'w-56 p-3',
  side: 'top',
  align: 'end',
  triggerLabel: 'Remove',
  triggerAriaLabel: '',
  triggerColor: 'neutral',
  triggerVariant: 'ghost',
  triggerSize: 'xs',
  triggerIcon: '',
  triggerShowLabel: true,
})

const emit = defineEmits<{
  cancel: []
  confirm: [{ close: () => void }]
}>()
const open = defineModel<boolean>('open', { default: false })
const running = ref(false)
const actionError = ref('')
watch(open, (isOpen) => { if (isOpen) actionError.value = '' })
const busy = computed(() => running.value || props.confirmLoading)
const cancelButton = useTemplateRef('cancelButton')
let trigger: HTMLElement | null = null
const focusCancel = (event: Event) => {
  event.preventDefault()
  trigger = props.reference || document.activeElement as HTMLElement | null
  nextTick(() => cancelButton.value?.$el?.focus())
}
const focusSurvivor = () => {
  if (props.focusFallback) { props.focusFallback(); return }
  const heading = document.querySelector<HTMLElement>('main h1')
  heading?.setAttribute('tabindex', '-1')
  heading?.focus()
}
const restoreFocus = (event: Event) => {
  if (props.reference) {
    event.preventDefault()
    nextTick(() => {
      if (props.reference?.isConnected) props.reference.focus()
      else focusSurvivor()
    })
    return
  }
  if (trigger?.isConnected) return
  event.preventDefault()
  nextTick(focusSurvivor)
}
const confirm = async (close: () => void) => {
  if (busy.value) return
  actionError.value = ''
  const complete = () => { close(); nextTick(() => { if (!trigger?.isConnected) focusSurvivor() }) }
  if (!props.action) { emit('confirm', { close: complete }); return }
  running.value = true
  try { await props.action(); complete() }
  catch (error) { actionError.value = (error as Error).message || 'Unable to complete action. Try again.' }
  finally {
    running.value = false
    if (actionError.value) await nextTick(() => cancelButton.value?.$el?.focus())
  }
}
</script>

<template>
  <DefineContent v-slot="{ controls }">
    <div class="space-y-3">
      <slot name="content">
        <p v-if="!modal" class="text-sm text-muted">{{ message }}</p>
      </slot>
      <p v-if="actionError" role="alert" class="text-sm text-error">{{ actionError }}</p>
      <div class="flex justify-end gap-2">
        <UButton ref="cancelButton" :disabled="busy" :size="cancelSize" :variant="cancelVariant" :color="cancelColor" @click="emit('cancel'); controls.close()">
          {{ cancelLabel }}
        </UButton>
        <UButton
          :size="confirmSize"
          :variant="confirmVariant"
          :color="confirmColor"
          :icon="confirmIcon || undefined"
          :loading="busy"
          @click="confirm(controls.close)"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </div>

  </DefineContent>
  <UModal v-if="modal" v-model:open="open" :title="confirmLabel" :description="message" :dismissible="!busy" :close="false" :content="{ onOpenAutoFocus: focusCancel, onCloseAutoFocus: restoreFocus }">
    <template #body><ReuseContent :controls="{ close: () => { open = false } }" /></template>
  </UModal>
  <UPopover v-else v-model:open="open" :reference="reference" :dismissible="!busy" :content="{ side, align, onOpenAutoFocus: focusCancel, onCloseAutoFocus: restoreFocus }" :ui="{ content: contentClass }">
    <template v-if="!hideTrigger" #default>
    <slot name="trigger">
      <UButton
        :size="triggerSize"
        :color="triggerColor"
        :variant="triggerVariant"
        :icon="triggerIcon || undefined"
        :aria-label="triggerAriaLabel || triggerLabel"
        :disabled="disabled || busy"
      >
        <template v-if="triggerShowLabel">
          {{ triggerLabel }}
        </template>
      </UButton>
    </slot>
    </template>

    <template #content="{ close }"><ReuseContent :controls="{ close }" /></template>
  </UPopover>
</template>
