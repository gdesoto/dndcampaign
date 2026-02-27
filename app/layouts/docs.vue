<script setup lang="ts">
const { navigationItems } = useUiRefreshDocs()
</script>

<template>
  <div class="theme-shell">
    <div class="theme-overlay theme-overlay-noise" />
    <div class="theme-overlay theme-overlay-pattern" />

    <div class="relative z-10 min-h-screen">
      <AppHeader />

      <div class="w-full px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <UPage>
          <template #left>
            <UPageAside>
              <UCard :ui="{ body: 'p-2' }">
                <UNavigationMenu
                  :items="navigationItems"
                  orientation="vertical"
                  :ui="{ linkLabel: 'font-display tracking-[0.08em] uppercase' }"
                />
              </UCard>
            </UPageAside>
          </template>

          <slot />
        </UPage>
      </div>
    </div>
  </div>
</template>
