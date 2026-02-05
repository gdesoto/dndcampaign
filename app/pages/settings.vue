<script setup lang="ts">
definePageMeta({ layout: 'app' })

type RuntimeConfigSnapshot = {
  generatedAt: string
  values: Record<string, unknown>
}

const isDev = true; //import.meta.dev
const { request } = useApi()

const { data: runtimeConfig, pending, error, refresh } = await useAsyncData(
  'runtime-config',
  () => request<RuntimeConfigSnapshot>('/api/dev/runtime-config'),
  { immediate: isDev }
)

const runtimeConfigJson = computed(() => {
  if (!runtimeConfig.value) return ''
  return JSON.stringify(runtimeConfig.value.values, null, 2)
})
</script>

<template>
  <UPage>
    <UHeader>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Account</p>
        <h1 class="mt-2 text-2xl font-semibold">Settings</h1>
      </div>
    </UHeader>

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Preferences</h2>
          </template>
          <p class="text-sm text-default">Settings will be available in a later milestone.</p>
        </UCard>

        <UCard v-if="isDev">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Developer panel</p>
                <h2 class="mt-1 text-lg font-semibold">Server runtime config</h2>
              </div>
              <UButton size="sm" variant="outline" :loading="pending" @click="refresh">
                Refresh
              </UButton>
            </div>
          </template>

          <div v-if="pending" class="space-y-3">
            <div class="h-4 w-40 animate-pulse rounded bg-muted"></div>
            <div class="h-24 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Unable to load runtime config.</p>
            <UButton size="sm" variant="outline" @click="refresh">Try again</UButton>
          </div>

          <div v-else class="space-y-3">
            <p class="text-xs text-muted">
              Generated at: <span class="font-medium text-default">{{ runtimeConfig?.generatedAt }}</span>
            </p>
            <pre
              class="max-h-96 overflow-auto rounded-md border border-default bg-muted/40 p-4 text-xs text-default"
            >{{ runtimeConfigJson }}</pre>
          </div>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>


