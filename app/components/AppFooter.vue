<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="mt-10 border-t border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/70">
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-[var(--ui-text-muted)] sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
      <p>© {{ currentYear }} DM Vault</p>
      <div class="flex items-center gap-4">
        <NuxtLink to="/docs" class="hover:text-[var(--ui-text)]">Docs</NuxtLink>
        <NuxtLink to="/public" class="hover:text-[var(--ui-text)]">Public Campaigns</NuxtLink>
      </div>
    </div>
  </footer>
</template>
