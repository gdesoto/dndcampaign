<script setup lang="ts">
import type { ApiKeyCampaignOption, ApiKeyRecord } from './types'

const props = withDefaults(defineProps<{
  keys: ApiKeyRecord[]
  campaigns: ApiKeyCampaignOption[]
  pending?: boolean
  revoke?: (key: ApiKeyRecord) => Promise<void>
}>(), { pending: false, revoke: undefined })

const emit = defineEmits<{
  edit: [key: ApiKeyRecord]
}>()

const campaignName = (id: string) => props.campaigns.find(campaign => campaign.id === id)?.name || 'Unknown campaign'
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : 'Never'
const isExpired = (key: ApiKeyRecord) => Boolean(key.expiresAt && new Date(key.expiresAt).getTime() < Date.now())
const revokeKey = (key: ApiKeyRecord) => props.revoke?.(key) || Promise.resolve()
const status = (key: ApiKeyRecord) => {
  if (key.revokedAt) return { label: 'Revoked', color: 'error' as const }
  if (isExpired(key)) return { label: 'Expired', color: 'warning' as const }
  return { label: 'Active', color: 'success' as const }
}
</script>

<template>
  <SharedResourceState
    :pending="pending"
    :has-data="Boolean(keys.length)"
    :empty="!keys.length"
    empty-message="No API keys yet. Create one when you are ready to connect an agent."
  >
    <div class="space-y-3">
      <article v-for="key in keys" :key="key.id" class="rounded-md border border-default bg-muted/10 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="type-record truncate">{{ key.name }}</h3>
              <UBadge :color="status(key).color" variant="subtle">{{ status(key).label }}</UBadge>
            </div>
            <p class="mt-1 text-xs text-muted">Created {{ formatDate(key.createdAt) }} · Last used {{ formatDate(key.lastUsedAt) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" aria-label="Edit API key" @click="emit('edit', key)" />
            <SharedConfirmActionPopover
              v-if="!key.revokedAt && revoke"
              :message="`Revoke ${key.name}? Agents using this key will lose access immediately.`"
              trigger-label="Revoke"
              trigger-aria-label="Revoke API key"
              trigger-icon="i-lucide-ban"
              :trigger-show-label="false"
              :action="() => revokeKey(key)"
              :disabled="pending"
            />
          </div>
        </div>

        <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt class="type-label text-dimmed">Campaigns</dt>
            <dd class="mt-1 text-muted">{{ key.campaignIds.map(campaignName).join(', ') || 'None' }}</dd>
          </div>
          <div>
            <dt class="type-label text-dimmed">Expires</dt>
            <dd class="mt-1 text-muted">{{ key.expiresAt ? formatDate(key.expiresAt) : 'Never' }}</dd>
          </div>
          <div>
            <dt class="type-label text-dimmed">Permissions</dt>
            <dd class="mt-1 text-muted">{{ new Set(key.permissions.map(permission => permission.split('.')[0])).size }} resources</dd>
          </div>
        </dl>
      </article>
    </div>
  </SharedResourceState>
</template>
