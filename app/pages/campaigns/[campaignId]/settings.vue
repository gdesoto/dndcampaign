<script setup lang="ts">
definePageMeta({ layout: 'app' })
</script>

<template>
  <div class="space-y-8">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Settings</p>
      <h1 class="mt-2 text-2xl font-semibold">Campaign settings</h1>
    </div>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">General</h2>
      </template>
      <p class="text-sm text-muted">Campaign settings will be available in a later milestone.</p>
    </UCard>
  </div>
</template>
