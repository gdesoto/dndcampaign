<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <UFooter class="mt-10 border-t border-default bg-elevated/70">
    <template #left>
      <p class="text-muted">© {{ currentYear }} DM Vault</p>
    </template>

    <div class="flex items-center gap-4">
      <NuxtLink to="/docs" class="text-muted hover:text-default">Docs</NuxtLink>
      <NuxtLink to="/public" class="text-muted hover:text-default">Public Campaigns</NuxtLink>
    </div>
  </UFooter>
</template>
