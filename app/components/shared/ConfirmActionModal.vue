<script setup lang="ts">
const props = withDefaults(defineProps<{
  reference?: HTMLElement
  focusFallback?: () => void
  action?: () => Promise<unknown>
  title?: string
  description?: string
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
}>(), {
  reference: undefined,
  focusFallback: undefined,
  action: undefined,
  title: 'Confirm action',
  description: 'Are you sure?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  confirmColor: 'error',
  cancelColor: 'neutral',
  confirmVariant: 'solid',
  cancelVariant: 'outline',
  confirmSize: 'md',
  cancelSize: 'md',
  confirmIcon: '',
  confirmLoading: false,
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
  <UModal v-model:open="open" :title="title" :description="description" :dismissible="!busy" :close="false" :content="{ onOpenAutoFocus: focusCancel, onCloseAutoFocus: restoreFocus }">
    <template #body>
      <div class="space-y-3">
        <slot name="content" />
        <p v-if="actionError" role="alert" class="text-sm text-error">{{ actionError }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton ref="cancelButton" :disabled="busy" :size="cancelSize" :variant="cancelVariant" :color="cancelColor" @click="emit('cancel'); open = false">
            {{ cancelLabel }}
          </UButton>
          <UButton :size="confirmSize" :variant="confirmVariant" :color="confirmColor" :icon="confirmIcon || undefined" :loading="busy" @click="confirm(() => { open = false })">
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
