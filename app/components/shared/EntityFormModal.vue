<script setup lang="ts">
import type { FormProps } from '@nuxt/ui'
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
const busy = computed(() => props.open && (props.saving || props.deleteLoading))
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
</script>

<template>
  <UModal v-model:open="openModel" :title="title" :description="description" :dismissible="false" :close="false" scrollable>
    <template #body>
        <UForm :state="state" :schema="schema" :validate-on="['blur']" :disabled="busy" class="space-y-4" @submit.prevent="onSubmit">
          <fieldset :disabled="busy" class="space-y-4"><slot /></fieldset>
          <p v-if="error" class="text-sm text-error">{{ error }}</p>

          <template v-if="$slots.footerActions">
            <slot name="footerActions" />
          </template>
          <template v-else>
            <div class="flex items-center justify-between gap-3">
              <div>
                <SharedConfirmActionPopover
                  v-if="showDeleteAction"
                  trigger-label="Delete"
                  trigger-color="neutral"
                  trigger-variant="ghost"
                  :trigger-icon="deleteIcon"
                  :disabled="deleteDisabled || busy"
                  confirm-label="Delete"
                  :confirm-loading="deleteLoading"
                  @confirm="onDelete"
                >
                  <template #content>
                    <p class="text-sm text-muted">Delete this item? This action cannot be undone.</p>
                  </template>
                </SharedConfirmActionPopover>
              </div>
              <div class="flex justify-end gap-3">
                <UButton variant="outline" color="neutral" :disabled="busy" @click="onCancel">{{ cancelLabel }}</UButton>
                <UButton type="submit" color="primary" variant="solid" :disabled="deleteLoading" :loading="saving">{{ submitLabel }}</UButton>
              </div>
            </div>
          </template>
        </UForm>
    </template>
  </UModal>
</template>
