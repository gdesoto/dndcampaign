<script setup lang="ts">
const props = withDefaults(defineProps<{
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
  set: (value: boolean) => emit('update:open', value),
})
const formState = reactive<Record<string, never>>({})

const onCancel = () => {
  openModel.value = false
  emit('cancel')
}

const onSubmit = () => {
  emit('submit')
}

const onDelete = () => {
  emit('delete')
}
</script>

<template>
  <UModal v-model:open="openModel" :dismissible="false" scrollable>
    <template #content>
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold">{{ title }}</h2>
            <p v-if="description" class="text-sm text-muted">{{ description }}</p>
          </div>
        </template>

        <UForm :state="formState" class="space-y-4" @submit.prevent="onSubmit">
          <slot />
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
                  trigger-color="error"
                  trigger-variant="ghost"
                  :trigger-icon="deleteIcon"
                  :disabled="deleteDisabled"
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
                <UButton variant="ghost" color="neutral" @click="onCancel">{{ cancelLabel }}</UButton>
                <UButton type="submit" :loading="saving">{{ submitLabel }}</UButton>
              </div>
            </div>
          </template>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
