<script setup lang="ts">
import type { ApiKeyCampaignOption, ApiKeyDraft, ApiKeyRecord } from '../../components/account/api-keys/types'
import type { ApiKeyPermission } from '#shared/schemas/api-key'

const { request } = useApi()

const {
  data: keys,
  pending: keysPending,
  error: keysError,
  refresh: refreshKeys,
} = await useAsyncData('account-api-keys', async () => {
  const response = await request<{ keys: ApiKeyRecord[] }>('/api/account/api-keys')
  if (!response) throw new Error('Unable to load API keys.')
  return response.keys
}, { default: () => [] })

const {
  data: campaigns,
  pending: campaignsPending,
  error: campaignsError,
  refresh: refreshCampaigns,
} = await useAsyncData('account-api-key-campaigns', async () => {
  const response = await request<ApiKeyCampaignOption[]>('/api/campaigns')
  if (!response) throw new Error('Unable to load campaigns.')
  return response
}, { default: () => [] })

const formRef = ref<{ dirty: boolean; reset: () => void; markSubmitted: () => void } | null>(null)
const selectedKey = ref<ApiKeyRecord | null>(null)
const secret = ref('')
const mutationError = ref('')
const mutationSuccess = ref('')
const saving = ref(false)
const isEditing = computed(() => Boolean(selectedKey.value))
const loading = computed(() => keysPending.value || campaignsPending.value)
const keyItems = computed(() => keys.value ?? [])
const campaignItems = computed(() => campaigns.value ?? [])

const toDateTimeInput = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const initialDraft = computed(() => {
  const key = selectedKey.value
  if (!key) return undefined
  return {
    name: key.name,
    campaignIds: key.campaignIds,
    permissions: key.permissions,
    expiresAt: toDateTimeInput(key.expiresAt),
  }
})

const saveKey = async (draft: ApiKeyDraft) => {
  if (saving.value) return
  if (!selectedKey.value && secret.value) {
    mutationError.value = 'Dismiss the one-time secret before creating another key.'
    return
  }
  saving.value = true
  mutationError.value = ''
  mutationSuccess.value = ''
  secret.value = ''

  try {
    let expiresAt: string | null = null
    if (draft.expiresAt) {
      const parsedExpiration = new Date(draft.expiresAt)
      if (Number.isNaN(parsedExpiration.getTime())) {
        throw new Error('Enter a valid expiration date.')
      }
      expiresAt = selectedKey.value && draft.expiresAt === toDateTimeInput(selectedKey.value.expiresAt)
        ? selectedKey.value.expiresAt
        : parsedExpiration.toISOString()
    }
    const payload = {
      name: draft.name,
      campaignIds: draft.campaignIds,
      permissions: Object.entries(draft.permissions).flatMap(([resource, access]) => [
        ...(access.read ? [`${resource}.read` as ApiKeyPermission] : []),
        ...(access.write ? [`${resource}.write` as ApiKeyPermission] : []),
      ]),
      expiresAt,
    }
    if (selectedKey.value) {
      await request<ApiKeyRecord>(`/api/account/api-keys/${selectedKey.value.id}`, { method: 'PATCH', body: payload })
    } else {
      const response = await request<{ key: ApiKeyRecord; secret: string }>('/api/account/api-keys', { method: 'POST', body: payload })
      if (!response) throw new Error('Unable to create API key.')
      secret.value = response.secret
    }
    await refreshKeys()
    formRef.value?.markSubmitted()
    if (selectedKey.value) {
      mutationSuccess.value = 'API key updated.'
      selectedKey.value = null
    } else {
      mutationSuccess.value = 'API key created.'
      formRef.value?.reset()
    }
  } catch (error) {
    mutationError.value = (error as Error & { message?: string }).message || 'Unable to save API key.'
  } finally {
    saving.value = false
  }
}

const revokeKey = async (key: ApiKeyRecord) => {
  mutationError.value = ''
  try {
    await request(`/api/account/api-keys/${key.id}`, { method: 'DELETE' })
    await refreshKeys()
    mutationSuccess.value = `${key.name} was revoked.`
  } catch (error) {
    mutationError.value = (error as Error & { message?: string }).message || 'Unable to revoke API key.'
    throw error
  }
}

const beginEdit = (key: ApiKeyRecord) => {
  if (secret.value) {
    mutationError.value = 'Dismiss the one-time secret before editing an API key.'
    return
  }
  if (formRef.value?.dirty) {
    mutationError.value = 'Save or cancel your current API key changes before editing another key.'
    return
  }
  secret.value = ''
  mutationError.value = ''
  mutationSuccess.value = ''
  selectedKey.value = key
}

const cancelEdit = () => {
  selectedKey.value = null
  mutationError.value = ''
}

const clearCreateDraft = () => {
  formRef.value?.reset()
  mutationError.value = ''
  mutationSuccess.value = ''
}

const retry = async () => {
  await Promise.all([refreshKeys(), refreshCampaigns()])
}

useUnsavedChanges(() => Boolean(formRef.value?.dirty), saving)
</script>

<template>
  <div class="space-y-6">
      <AccountApiKeysSecretReveal v-if="secret" :secret="secret" @dismiss="secret = ''" />

        <UAlert v-if="mutationSuccess" color="success" variant="subtle" :description="mutationSuccess" role="status" />
        <UAlert v-if="mutationError" color="error" variant="subtle" :description="mutationError" role="alert" />

        <UCard>
          <template #header>
            <div>
              <p class="type-label text-dimmed">{{ isEditing ? 'Edit access' : 'New connection' }}</p>
              <h2 class="mt-1 type-section">{{ isEditing ? `Edit ${selectedKey?.name}` : 'Create an API key' }}</h2>
            </div>
          </template>

          <div v-if="campaignsError" class="space-y-3">
            <UAlert color="error" title="Unable to load campaigns" description="Campaign selection is required before creating a key." />
            <UButton color="neutral" variant="outline" :loading="loading" @click="retry">Try again</UButton>
          </div>
          <div v-else-if="loading && !campaignItems.length" class="space-y-3" aria-busy="true">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-40 w-full" />
          </div>
          <AccountApiKeysForm
            v-else
            ref="formRef"
            :campaigns="campaignItems"
            :initial="initialDraft"
            :editing="isEditing"
            :submitting="saving"
            @submit="saveKey"
            @cancel="cancelEdit"
            @clear="clearCreateDraft"
          />
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="type-label text-dimmed">Existing connections</p>
                <h2 class="mt-1 type-section">Your API keys</h2>
              </div>
              <UBadge color="neutral" variant="subtle">{{ keyItems.length }} total</UBadge>
            </div>
          </template>

          <div v-if="keysError" class="space-y-3">
            <UAlert color="error" title="Unable to load API keys" description="Your existing keys are unavailable right now." />
            <UButton color="neutral" variant="outline" :loading="keysPending" @click="() => refreshKeys()">Try again</UButton>
          </div>
          <AccountApiKeysList
            v-else
            :keys="keyItems"
            :campaigns="campaignItems"
            :pending="keysPending"
            :revoke="revokeKey"
            @edit="beginEdit"
          />
        </UCard>
    </div>
</template>
