<script setup lang="ts">
const emit = defineEmits<{ close: [value: boolean] }>()
</script>

<template>
  <UModal title="Discard unsaved changes?" description="Your changes have not been saved." :close="false" @update:open="value => { if (!value) emit('close', false) }">
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton autofocus color="neutral" variant="outline" @click="emit('close', false)">Keep editing</UButton>
        <UButton color="error" variant="solid" @click="emit('close', true)">Discard changes</UButton>
      </div>
    </template>
  </UModal>
</template>
