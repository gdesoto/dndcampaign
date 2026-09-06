<script setup lang="ts">
import { recapWatchLink } from '~/utils/recap-links'

const props = defineProps<{ basePath: string; recapId: string; hideOpen?: boolean }>()
const url = computed(() => recapWatchLink(props.basePath, props.recapId))
const isPublic = computed(() => props.basePath.startsWith('/public/'))
const shareError = ref('')
const copied = ref(false)
watch(url, () => { copied.value = false; shareError.value = '' })
const copyLink = async () => {
  shareError.value = ''
  try {
    await navigator.clipboard.writeText(new URL(url.value, window.location.origin).href)
    copied.value = true
  } catch {
    shareError.value = 'Unable to copy. Open the playlist and copy its address from your browser.'
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton v-if="!hideOpen" :to="url" size="xs" variant="outline" icon="i-lucide-list-video">Open playlist</UButton>
    <UButton size="xs" variant="ghost" icon="i-lucide-link" @click="copyLink">
      {{ copied ? 'Link copied' : isPublic ? 'Copy public link' : 'Copy campaign link' }}
    </UButton>
    <p v-if="shareError" role="alert" class="w-full text-xs text-error">{{ shareError }}</p>
  </div>
</template>
