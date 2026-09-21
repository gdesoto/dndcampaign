<script setup lang="ts">
const props = defineProps<{ secret: string }>()
const emit = defineEmits<{ dismiss: [] }>()
const copied = ref(false)
const copyError = ref('')

const copySecret = async () => {
  copied.value = false
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(props.secret)
    copied.value = true
  } catch {
    copyError.value = 'Copy was unavailable. Select the key and copy it manually.'
  }
}
</script>

<template>
  <UAlert color="success" variant="subtle" title="API key created">
    <template #description>
      <div class="space-y-3">
        <p>Copy this secret now. It will not be shown again after you leave this page.</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code class="min-w-0 flex-1 select-all break-all rounded border border-default bg-muted/30 px-3 py-2 text-xs text-highlighted">{{ secret }}</code>
          <UButton color="neutral" variant="outline" icon="i-lucide-copy" @click="copySecret">{{ copied ? 'Copied' : 'Copy key' }}</UButton>
        </div>
        <p v-if="copyError" role="alert" class="text-sm text-error">{{ copyError }}</p>
        <p v-else-if="copied" role="status" class="text-sm text-success">Copied to clipboard.</p>
        <UButton color="neutral" variant="ghost" size="sm" @click="emit('dismiss')">I’ve copied it / dismiss</UButton>
      </div>
    </template>
  </UAlert>
</template>
