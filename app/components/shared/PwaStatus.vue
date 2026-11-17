<script setup lang="ts">
const nuxtApp = useNuxtApp()
const { $pwa } = nuxtApp
const offline = ref(false)
const buildChanged = ref(false)
const offlineDismissed = ref(false)
const updateDismissed = ref(false)
const errorDismissed = ref(false)
const closeButton = { class: 'size-10 -m-2' }
const updateAvailable = computed(() => buildChanged.value || $pwa?.needRefresh)
const showUpdate = () => {
  buildChanged.value = true
  updateDismissed.value = false
}
const removeBuildHook = nuxtApp.hook('app:manifest:update', showUpdate)
const removeChunkHook = nuxtApp.hook('app:chunkError', showUpdate)
const syncConnection = () => {
  offline.value = !navigator.onLine
  offlineDismissed.value = false
}

onMounted(() => {
  syncConnection()
  window.addEventListener('online', syncConnection)
  window.addEventListener('offline', syncConnection)
})
onBeforeUnmount(() => {
  removeBuildHook()
  removeChunkHook()
  window.removeEventListener('online', syncConnection)
  window.removeEventListener('offline', syncConnection)
})
</script>

<template>
  <div
    v-if="(offline && !offlineDismissed) || (updateAvailable && !updateDismissed) || ($pwa?.registrationError && !errorDismissed)"
    class="fixed inset-x-0 z-50 mx-auto flex max-w-xl flex-col gap-2 p-3 *:bg-default"
    style="bottom: calc(var(--media-player-height, 0px) + env(safe-area-inset-bottom, 0px))"
    aria-label="App status"
  >
    <UAlert
      v-if="offline && !offlineDismissed"
      role="status"
      icon="i-lucide-wifi-off"
      color="warning"
      variant="subtle"
      title="You're offline"
      description="Campaign data, saving, and playback need a connection. Keep this page open to preserve your work."
      aria-label="Offline notice"
      :close="closeButton"
      @update:open="offlineDismissed = true"
    />
    <UAlert
      v-if="updateAvailable && !updateDismissed"
      role="status"
      icon="i-lucide-refresh-cw"
      color="info"
      variant="subtle"
      title="Update available"
      description="When you're done listening, save your work and close all DM Vault tabs and windows. Reopen to use the update."
      aria-label="Update notice"
      :close="closeButton"
      @update:open="updateDismissed = true"
    />
    <UAlert
      v-if="$pwa?.registrationError && !errorDismissed"
      role="status"
      icon="i-lucide-cloud-alert"
      color="warning"
      variant="subtle"
      title="App setup incomplete"
      description="The offline notice and update checks are unavailable. You can keep using DM Vault online; try reopening after saving your work."
      aria-label="App setup notice"
      :close="closeButton"
      @update:open="errorDismissed = true"
    />
  </div>
</template>
