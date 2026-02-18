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

type AccountProfile = {
  id: string
  email: string
  name: string
  systemRole: 'USER' | 'SYSTEM_ADMIN'
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const isDev = import.meta.dev
const { request } = useApi()
const account = useAccount()

const profileForm = reactive({
  name: '',
  avatarUrl: '',
})

const emailForm = reactive({
  newEmail: '',
  password: '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
})

const profileAction = reactive({
  saving: false,
  error: '',
  success: '',
})

const emailAction = reactive({
  saving: false,
  error: '',
  success: '',
})

const passwordAction = reactive({
  saving: false,
  error: '',
  success: '',
})

const revokeAction = reactive({
  running: false,
  error: '',
  success: '',
})

const {
  data: profile,
  pending: profilePending,
  refresh: refreshProfile,
} = await useAsyncData<AccountProfile>('account-profile', async () => {
  const response = await account.getProfile()
  return response.profile
})

const {
  data: sessions,
  pending: sessionsPending,
  refresh: refreshSessions,
} = await useAsyncData('account-sessions', async () => {
  const response = await account.listSessions()
  return response.sessions
})

watch(
  profile,
  (value) => {
    if (!value) return
    profileForm.name = value.name
    profileForm.avatarUrl = value.avatarUrl || ''
    emailForm.newEmail = value.email
  },
  { immediate: true }
)

const saveProfile = async () => {
  profileAction.error = ''
  profileAction.success = ''
  profileAction.saving = true

  try {
    await account.updateProfile({
      name: profileForm.name,
      avatarUrl: profileForm.avatarUrl.trim() ? profileForm.avatarUrl.trim() : null,
    })
    await refreshProfile()
    profileAction.success = 'Profile updated.'
  } catch (error) {
    profileAction.error = (error as Error & { message?: string }).message || 'Unable to update profile.'
  } finally {
    profileAction.saving = false
  }
}

const saveEmail = async () => {
  emailAction.error = ''
  emailAction.success = ''
  emailAction.saving = true

  try {
    await account.changeEmail({
      newEmail: emailForm.newEmail,
      password: emailForm.password,
    })
    emailForm.password = ''
    await refreshProfile()
    emailAction.success = 'Email updated.'
  } catch (error) {
    emailAction.error = (error as Error & { message?: string }).message || 'Unable to update email.'
  } finally {
    emailAction.saving = false
  }
}

const savePassword = async () => {
  passwordAction.error = ''
  passwordAction.success = ''
  passwordAction.saving = true

  try {
    await account.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordAction.success = 'Password updated.'
  } catch (error) {
    passwordAction.error = (error as Error & { message?: string }).message || 'Unable to update password.'
  } finally {
    passwordAction.saving = false
  }
}

const revokeOtherSessions = async () => {
  revokeAction.error = ''
  revokeAction.success = ''
  revokeAction.running = true

  try {
    const response = await account.revokeOtherSessions()
    await refreshSessions()
    revokeAction.success = `Revoked ${response.revokedSessions} other sessions.`
  } catch (error) {
    revokeAction.error =
      (error as Error & { message?: string }).message || 'Unable to revoke other sessions.'
  } finally {
    revokeAction.running = false
  }
}

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

const { data: devSessions, refresh: refreshDevSessions } = await useAsyncData(
  () => `dev-sessions-${n8nForm.campaignId}`,
  () => {
    if (!n8nForm.campaignId) return Promise.resolve([] as SessionOption[])
    return request<SessionOption[]>(`/api/campaigns/${n8nForm.campaignId}/sessions`)
  },
  { immediate: false }
)

const sessionOptions = computed(() =>
  (devSessions.value || []).map((session) => {
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
    await refreshDevSessions()
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
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Profile</p>
                <h2 class="mt-1 text-lg font-semibold">Account profile</h2>
              </div>
              <UBadge color="neutral" variant="subtle">{{ profile?.systemRole || 'USER' }}</UBadge>
            </div>
          </template>

          <div v-if="profilePending" class="space-y-3">
            <div class="h-4 w-40 animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Display name</label>
                <UInput v-model="profileForm.name" placeholder="Display name" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Avatar URL (optional)</label>
                <UInput v-model="profileForm.avatarUrl" placeholder="https://..." />
              </div>
            </div>
            <p class="text-xs text-muted">Email: {{ profile?.email }}</p>
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="profileAction.saving" @click="saveProfile">Save profile</UButton>
              <p v-if="profileAction.success" class="text-sm text-success">{{ profileAction.success }}</p>
              <p v-if="profileAction.error" class="text-sm text-error">{{ profileAction.error }}</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Security</h2>
          </template>

          <div class="space-y-6">
            <div class="space-y-3">
              <h3 class="text-sm font-semibold">Change email</h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="mb-2 block text-sm text-muted">New email</label>
                  <UInput v-model="emailForm.newEmail" type="email" placeholder="you@example.com" />
                </div>
                <div>
                  <label class="mb-2 block text-sm text-muted">Current password</label>
                  <UInput v-model="emailForm.password" type="password" placeholder="••••••••••" />
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <UButton :loading="emailAction.saving" @click="saveEmail">Update email</UButton>
                <p v-if="emailAction.success" class="text-sm text-success">{{ emailAction.success }}</p>
                <p v-if="emailAction.error" class="text-sm text-error">{{ emailAction.error }}</p>
              </div>
            </div>

            <USeparator />

            <div class="space-y-3">
              <h3 class="text-sm font-semibold">Change password</h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="mb-2 block text-sm text-muted">Current password</label>
                  <UInput
                    v-model="passwordForm.currentPassword"
                    type="password"
                    placeholder="••••••••••"
                  />
                </div>
                <div>
                  <label class="mb-2 block text-sm text-muted">New password</label>
                  <UInput v-model="passwordForm.newPassword" type="password" placeholder="••••••••••" />
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <UButton :loading="passwordAction.saving" @click="savePassword">Update password</UButton>
                <p v-if="passwordAction.success" class="text-sm text-success">{{ passwordAction.success }}</p>
                <p v-if="passwordAction.error" class="text-sm text-error">{{ passwordAction.error }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Active sessions</h2>
              <UButton
                size="sm"
                variant="outline"
                :loading="revokeAction.running"
                @click="revokeOtherSessions"
              >
                Revoke other sessions
              </UButton>
            </div>
          </template>

          <div class="space-y-3">
            <p v-if="revokeAction.success" class="text-sm text-success">{{ revokeAction.success }}</p>
            <p v-if="revokeAction.error" class="text-sm text-error">{{ revokeAction.error }}</p>

            <div v-if="sessionsPending" class="space-y-2">
              <div class="h-9 w-full animate-pulse rounded bg-muted"></div>
              <div class="h-9 w-full animate-pulse rounded bg-muted"></div>
            </div>

            <div v-else-if="sessions?.length" class="space-y-2">
              <div
                v-for="session in sessions"
                :key="session.id"
                class="rounded-md border border-default bg-muted/30 p-3 text-sm"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-medium">
                    {{ session.isCurrent ? 'Current session' : 'Session' }}
                  </p>
                  <UBadge v-if="session.isCurrent" color="success" variant="subtle">Current</UBadge>
                </div>
                <p class="mt-1 text-muted">{{ session.userAgent || 'Unknown device' }}</p>
                <p class="text-xs text-muted">
                  IP: {{ session.ipAddress || 'N/A' }}
                  · Last seen: {{ new Date(session.lastSeenAt).toLocaleString() }}
                </p>
              </div>
            </div>

            <p v-else class="text-sm text-muted">No active sessions found.</p>
          </div>
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
