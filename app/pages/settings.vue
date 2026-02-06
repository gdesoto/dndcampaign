<script setup lang="ts">
definePageMeta({ layout: 'app' })

type RuntimeConfigSnapshot = {
  generatedAt: string
  values: Record<string, unknown>
}

type CampaignOption = {
  id: string
  name: string
}

type SessionOption = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
}

const isDev = import.meta.dev
const { request } = useApi()

const n8nForm = reactive({
  webhookUrlOverride: '',
  promptProfile: '',
  useZod: false,
  campaignId: '',
  sessionId: '',
})
const n8nTesting = ref(false)
const n8nTestError = ref('')
const n8nTestResult = ref<Record<string, unknown> | null>(null)

const { data: runtimeConfig, pending, error, refresh } = await useAsyncData(
  'runtime-config',
  () => request<RuntimeConfigSnapshot>('/api/dev/runtime-config'),
  { immediate: isDev }
)

const runtimeConfigJson = computed(() => {
  if (!runtimeConfig.value) return ''
  return JSON.stringify(runtimeConfig.value.values, null, 2)
})

const { data: campaigns } = await useAsyncData(
  'dev-campaigns',
  () => request<CampaignOption[]>('/api/campaigns'),
  { immediate: isDev }
)

const campaignOptions = computed(() =>
  (campaigns.value || []).map((campaign) => ({
    label: campaign.name,
    value: campaign.id,
  }))
)

const { data: sessions, refresh: refreshSessions } = await useAsyncData(
  () => `dev-sessions-${n8nForm.campaignId}`,
  () => {
    if (!n8nForm.campaignId) return Promise.resolve([] as SessionOption[])
    return request<SessionOption[]>(`/api/campaigns/${n8nForm.campaignId}/sessions`)
  },
  { immediate: false }
)

const sessionOptions = computed(() =>
  (sessions.value || []).map((session) => {
    const number = session.sessionNumber ? `Session ${session.sessionNumber}` : 'Session'
    return {
      label: `${number}: ${session.title}`,
      value: session.id,
    }
  })
)

watch(
  () => n8nForm.campaignId,
  async (value) => {
    n8nForm.sessionId = ''
    if (!value) return
    await refreshSessions()
  }
)

const n8nTestResultJson = computed(() => {
  if (!n8nTestResult.value) return ''
  return JSON.stringify(n8nTestResult.value, null, 2)
})

const migrateForm = reactive({
  campaignId: '',
  deleteGlossary: false,
})
const migrateRunning = ref(false)
const migrateError = ref('')
const migrateResult = ref<Record<string, unknown> | null>(null)
const migrateResultJson = computed(() => {
  if (!migrateResult.value) return ''
  return JSON.stringify(migrateResult.value, null, 2)
})

const runCharacterMigration = async () => {
  migrateError.value = ''
  migrateResult.value = null
  migrateRunning.value = true
  try {
    const result = await request<Record<string, unknown>>('/api/dev/characters/migrate', {
      method: 'POST',
      body: {
        campaignId: migrateForm.campaignId || undefined,
        deleteGlossary: migrateForm.deleteGlossary || undefined,
      },
    })
    migrateResult.value = result
  } catch (error) {
    migrateError.value =
      (error as Error & { message?: string }).message || 'Unable to run character migration.'
  } finally {
    migrateRunning.value = false
  }
}

const runN8nTest = async () => {
  n8nTestError.value = ''
  n8nTestResult.value = null
  n8nTesting.value = true
  try {
    const result = await request<Record<string, unknown>>('/api/dev/n8n-test', {
      method: 'POST',
      body: {
        webhookUrlOverride: n8nForm.webhookUrlOverride || undefined,
        promptProfile: n8nForm.promptProfile || undefined,
        useZod: n8nForm.useZod || undefined,
        campaignId: n8nForm.campaignId || undefined,
        sessionId: n8nForm.sessionId || undefined,
      },
    })
    n8nTestResult.value = result
  } catch (error) {
    n8nTestError.value =
      (error as Error & { message?: string }).message || 'Unable to test n8n webhook.'
  } finally {
    n8nTesting.value = false
  }
}
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

        <UCard v-if="isDev">
          <template #header>
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Developer panel</p>
              <h2 class="mt-1 text-lg font-semibold">n8n webhook test</h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Campaign</label>
                <USelect
                  v-model="n8nForm.campaignId"
                  :items="campaignOptions"
                  placeholder="Select campaign"
                />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Session</label>
                <USelect
                  v-model="n8nForm.sessionId"
                  :items="sessionOptions"
                  :disabled="!n8nForm.campaignId"
                  placeholder="Select session"
                />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Webhook URL override</label>
                <UInput v-model="n8nForm.webhookUrlOverride" placeholder="https://n8n.example/webhook/..." />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Prompt profile (optional)</label>
                <UInput v-model="n8nForm.promptProfile" placeholder="session-summary+highlights+quests..." />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UCheckbox v-model="n8nForm.useZod" />
              <span class="text-sm text-muted">Validate response with Zod</span>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="n8nTesting" @click="runN8nTest">Send test webhook</UButton>
              <span class="text-xs text-muted">Validates a synchronous response.</span>
            </div>
            <p v-if="n8nTestError" class="text-sm text-error">{{ n8nTestError }}</p>
            <pre
              v-if="n8nTestResult"
              class="max-h-96 overflow-auto rounded-md border border-default bg-muted/40 p-4 text-xs text-default"
            >{{ n8nTestResultJson }}</pre>
          </div>
        </UCard>

        <UCard v-if="isDev">
          <template #header>
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Developer panel</p>
              <h2 class="mt-1 text-lg font-semibold">Character migration</h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Campaign (optional)</label>
                <USelect
                  v-model="migrateForm.campaignId"
                  :items="campaignOptions"
                  placeholder="All campaigns"
                />
              </div>
              <div class="flex items-center gap-2 pt-6">
                <UCheckbox v-model="migrateForm.deleteGlossary" />
                <span class="text-sm text-muted">Delete PC glossary entries after linking</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="migrateRunning" @click="runCharacterMigration">
                Run migration
              </UButton>
              <span class="text-xs text-muted">Links glossary PCs to campaign characters.</span>
            </div>
            <p v-if="migrateError" class="text-sm text-error">{{ migrateError }}</p>
            <pre
              v-if="migrateResult"
              class="max-h-96 overflow-auto rounded-md border border-default bg-muted/40 p-4 text-xs text-default"
            >{{ migrateResultJson }}</pre>
          </div>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
