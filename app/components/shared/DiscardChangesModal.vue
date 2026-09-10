<script setup lang="ts">
const emit = defineEmits<{ close: [value: boolean] }>()
let confirmed = false
const confirmDiscard = ({ close }: { close: () => void }) => {
  confirmed = true
  emit('close', true)
  close()
}
const handleOpenUpdate = (value: boolean) => {
  if (!value && !confirmed) emit('close', false)
  confirmed = false
}
</script>

<template>
  <ConfirmActionModal
    title="Discard unsaved changes?"
    description="Your changes have not been saved."
    cancel-label="Keep editing"
    confirm-label="Discard changes"
    confirm-color="error"
    cancel-variant="outline"
    @update:open="handleOpenUpdate"
    @confirm="confirmDiscard"
  />
</template>
