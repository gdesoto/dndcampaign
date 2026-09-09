<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { RecordAction } from '~/types/actions'

const props = defineProps<{
  name: string
  items: RecordAction[]
  disabled?: boolean
  focusFallback?: () => void
}>()

const toast = useToast()
const trigger = useTemplateRef('trigger')
const menuOpen = ref(false)
const tooltipOpen = ref(false)
const confirmationOpen = ref(false)
watch([menuOpen, confirmationOpen], ([menu, confirmation]) => { if (menu || confirmation) tooltipOpen.value = false })
const selected = shallowRef<RecordAction>()
const queued = shallowRef<RecordAction>()
const running = ref(false)
const reference = computed(() => trigger.value?.$el as HTMLElement | undefined)
const restoreFocus = () => {
  if (reference.value?.isConnected) { reference.value.focus(); return }
  if (props.focusFallback) { props.focusFallback(); return }
  const heading = document.querySelector<HTMLElement>('main h1')
  heading?.setAttribute('tabindex', '-1')
  heading?.focus()
}

const execute = async (item: RecordAction) => {
  if (running.value || props.disabled || item.disabled) return
  running.value = true
  try { await item.action?.() }
  catch (error) {
    toast.add({ title: `Unable to ${item.label.toLowerCase()}`, description: (error as Error).message || 'Try again.', color: 'error' })
  } finally {
    running.value = false
    await nextTick()
    if (!reference.value?.isConnected) restoreFocus()
  }
}

// Wait for the native menu to release focus before opening a dialog or popover.
const afterMenuClose = (event: Event) => {
  const item = queued.value
  if (!item) return
  event.preventDefault()
  queued.value = undefined
  requestAnimationFrame(() => {
    if (props.disabled || item.disabled) return
    restoreFocus()
    if (item.confirmation) {
      selected.value = item
      confirmationOpen.value = true
    } else {
      void execute(item)
    }
  })
}

const menuItems = computed<DropdownMenuItem[][]>(() => {
  const mapped = props.items.map(item => ({
    label: item.label,
    icon: item.icon,
    to: item.to,
    target: item.target,
    description: item.description,
    disabled: props.disabled || running.value || item.disabled,
    color: 'neutral' as const,
    ...(item.action ? { onSelect: () => { queued.value = item } } : {}),
  }))
  return [
    mapped.filter((_, index) => !props.items[index]?.destructive),
    mapped.filter((_, index) => props.items[index]?.destructive),
  ].filter(group => group.length)
})
</script>

<template>
  <div v-if="items.length" class="flex shrink-0 items-center" @click.stop>
    <UDropdownMenu
      v-model:open="menuOpen"
      :items="menuItems"
      :disabled="disabled || running || confirmationOpen"
      :content="{ align: 'end', onCloseAutoFocus: afterMenuClose }"
    >
      <UTooltip v-model:open="tooltipOpen" :disabled="menuOpen || confirmationOpen" :text="`Actions for ${name}`">
        <UButton
          ref="trigger"
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Actions for ${name}`"
          :disabled="disabled || running || confirmationOpen"
          :loading="running"
        />
      </UTooltip>
    </UDropdownMenu>
    <SharedConfirmActionPopover
      v-if="selected?.confirmation"
      v-model:open="confirmationOpen"
      hide-trigger
      :reference="reference"
      :modal="selected.confirmation.modal"
      :message="selected.confirmation.message"
      :confirm-label="selected.confirmation.label || selected.label"
      :confirm-icon="selected.icon"
      :action="async () => { await selected?.action?.() }"
      :focus-fallback="restoreFocus"
      content-class="w-80 max-w-[calc(100vw-2rem)] p-3"
    />
  </div>
</template>
