<script setup lang="ts">
import type { FormErrorEvent, FormProps } from '@nuxt/ui'
const props = withDefaults(defineProps<{
  state?: Record<string, any>
  schema?: FormProps<any>['schema']
  open: boolean
  title: string
  description?: string
  saving?: boolean
  error?: string
  submitLabel?: string
  cancelLabel?: string
  showDeleteAction?: boolean
  deleteLabel?: string
  deleteLoading?: boolean
  deleteDisabled?: boolean
  deleteIcon?: string
  deleteAction?: () => Promise<unknown>
  deleteMessage?: string
  recordName?: string
}>(), {
  state: () => ({}),
  schema: undefined,
  description: '',
  saving: false,
  error: '',
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  showDeleteAction: false,
  deleteLabel: 'Delete',
  deleteLoading: false,
  deleteDisabled: false,
  deleteIcon: 'i-lucide-trash-2',
  deleteAction: undefined,
  deleteMessage: '',
  recordName: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: []
  cancel: []
  delete: []
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => { if (value) emit('update:open', true); else void onCancel() },
})
const baseline = ref(JSON.stringify(props.state))
watch(() => props.open, (open) => { if (open) baseline.value = JSON.stringify(props.state) }, { flush: 'sync' })
const deleting = ref(false)
const busy = computed(() => props.open && (props.saving || props.deleteLoading || deleting.value))
const dirty = computed(() => props.open && JSON.stringify(props.state) !== baseline.value)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)

const onCancel = async () => {
  if (!await confirmDiscard()) return
  emit('update:open', false)
  emit('cancel')
}

const onSubmit = () => {
  if (!busy.value) emit('submit')
}

const onDelete = () => {
  if (!busy.value) emit('delete')
}

const deleteName = computed(() => props.recordName || String(props.state.name || props.state.title || 'this item'))
const runDelete = async () => {
  if (busy.value || props.deleteDisabled) return
  deleting.value = true
  try { await props.deleteAction?.() }
  finally { deleting.value = false }
}

const form = useTemplateRef('form')
const invalidFieldId = ref<string>()
const focusInvalidField = (event: FormErrorEvent) => {
  invalidFieldId.value = event.errors.find(error => error.id)?.id
}
// Error is emitted while UForm is still validating. Wait for its native loading
// lifecycle and the disabled inputs to render before moving focus.
watch([invalidFieldId, () => form.value?.loading], async ([id, loading]) => {
  if (!id || loading) return
  await nextTick()
  if (!props.open) return
  const field = document.getElementById(id)
  field?.focus()
  field?.scrollIntoView({ block: 'nearest' })
  invalidFieldId.value = undefined
}, { flush: 'post' })
</script>

<template>
  <UModal v-model:open="openModel" :title="title" :description="description" :dismissible="false" :close="false" scrollable>
    <template #body>
        <UForm ref="form" :state="state" :schema="schema" :validate-on="['blur']" :disabled="busy" :aria-busy="busy" class="min-w-0 space-y-4" @submit.prevent="onSubmit" @error="focusInvalidField">
          <fieldset :disabled="busy" class="min-w-0 space-y-4"><slot /></fieldset>
          <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>

          <template v-if="$slots.footerActions">
            <slot name="footerActions" />
          </template>
          <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
              <div>
                <SharedConfirmActionPopover
                  v-if="showDeleteAction"
                  :trigger-label="deleteLabel"
                  :trigger-aria-label="`${deleteLabel} ${deleteName}`"
                  trigger-color="neutral"
                  trigger-variant="ghost"
                  :trigger-icon="deleteIcon"
                  :disabled="deleteDisabled || busy"
                  :confirm-label="deleteLabel"
                  :message="deleteMessage || `${deleteLabel} ${deleteName}? This action cannot be undone.`"
                  :confirm-loading="deleteLoading || deleting"
                  :action="deleteAction ? runDelete : undefined"
                  @confirm="onDelete"
                />
              </div>
              <div class="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                <UButton variant="outline" color="neutral" :disabled="busy" @click="onCancel">{{ cancelLabel }}</UButton>
                <UButton type="submit" color="primary" variant="solid" :disabled="busy" :loading="saving">{{ submitLabel }}</UButton>
              </div>
            </div>
          </template>
        </UForm>
    </template>
  </UModal>
</template>
