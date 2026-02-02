<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { loggedIn, ready } = useUserSession()
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-muted">Dungeon Master Vault</p>
      <h1 class="mt-3 text-4xl font-semibold">Run smarter campaigns with one home base</h1>
      <p class="mt-4 max-w-2xl text-base text-default">
        Track sessions, manage your world, and keep transcripts and summaries tidy.
        This app is built to keep your D&amp;D campaign organized and searchable.
      </p>
    </div>

    <div class="flex flex-wrap gap-4">
      <UButton v-if="ready && !loggedIn" size="lg" to="/login">Go to login</UButton>
      <UButton v-else-if="ready && loggedIn" size="lg" to="/campaigns">
        Open campaigns
      </UButton>
      <UButton v-else size="lg" loading>Loading session</UButton>
    </div>
  </div>
</template>

