<script setup lang="ts">
const props = defineProps<{
  campaignId: string
  dungeonId: string
  floor: number
  floorLabel?: string
  floorCount: number
}>()
const open = defineModel<boolean>('open', { default: false })

const dungeonApi = useDungeonDetail()
const exporting = ref(false)
const error = ref('')
const form = reactive({
  format: 'PNG' as 'JSON' | 'SVG' | 'PNG' | 'PDF',
  mode: 'DM' as 'DM' | 'PLAYER',
  includeGrid: true,
  includeLabels: true,
  includeGmLayer: true,
})
const formats = [
  { label: 'PNG image', value: 'PNG' as const },
  { label: 'SVG image', value: 'SVG' as const },
  { label: 'PDF', value: 'PDF' as const },
  { label: 'JSON (re-importable)', value: 'JSON' as const },
]
const modes = [
  { label: 'DM full', value: 'DM' as const },
  { label: 'Player-safe', value: 'PLAYER' as const },
]
watch(open, (value) => { if (value) error.value = '' })

const download = async () => {
  if (exporting.value) return
  exporting.value = true
  error.value = ''
  try {
    const result = await dungeonApi.exportDungeon(props.campaignId, props.dungeonId, {
      format: form.format,
      playerSafe: form.mode === 'PLAYER',
      includeGrid: form.includeGrid,
      includeLabels: form.includeLabels,
      includeGmLayer: form.includeGmLayer,
      floor: form.format === 'JSON' ? undefined : props.floor,
    })
    if (!result) throw new Error('Empty export response.')
    const payload = result.encoding === 'base64'
      ? Uint8Array.from(atob(result.content), char => char.charCodeAt(0))
      : result.content
    const url = URL.createObjectURL(new Blob([payload], { type: result.contentType }))
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    open.value = false
  } catch (cause) {
    error.value = (cause as Error).message || 'Unable to export map.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Export map" :dismissible="!exporting">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Format">
            <USelect v-model="form.format" :items="formats" aria-label="Export format" class="w-full" />
          </UFormField>
          <UFormField label="Mode">
            <USelect v-model="form.mode" :items="modes" aria-label="Export mode" class="w-full" />
          </UFormField>
        </div>
        <div v-if="form.format !== 'JSON'" class="flex flex-wrap gap-x-6 gap-y-2">
          <USwitch v-model="form.includeGrid" label="Grid" />
          <USwitch v-model="form.includeLabels" label="Labels" />
          <USwitch v-model="form.includeGmLayer" label="GM layer" />
        </div>
        <p v-if="floorCount > 1" class="text-xs text-muted">
          {{ form.format === 'JSON' ? 'Includes every floor.' : `Exports ${floorLabel || `floor ${floor + 1}`}.` }}
        </p>
        <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" :disabled="exporting" @click="open = false">Cancel</UButton>
        <UButton icon="i-lucide-download" :loading="exporting" @click="download">Export map</UButton>
      </div>
    </template>
  </UModal>
</template>
