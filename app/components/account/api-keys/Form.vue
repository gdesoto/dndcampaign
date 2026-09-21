<script setup lang="ts">
import type { ApiKeyPermission } from '#shared/schemas/api-key'
import type { ApiKeyCampaignOption, ApiKeyDraft, ApiKeyPermissionsState } from './types'
import { apiKeyResources } from './types'

const makePermissions = (permissions?: ApiKeyPermission[] | Partial<ApiKeyPermissionsState>): ApiKeyPermissionsState => Object.fromEntries(
  apiKeyResources.map(({ key }) => [key, {
    read: Array.isArray(permissions) ? permissions.includes(`${key}.read` as ApiKeyPermission) : Boolean(permissions?.[key]?.read),
    write: Array.isArray(permissions) ? permissions.includes(`${key}.write` as ApiKeyPermission) : Boolean(permissions?.[key]?.write),
  }]),
) as ApiKeyPermissionsState

const props = withDefaults(defineProps<{
  campaigns: ApiKeyCampaignOption[]
  initial?: Omit<Partial<ApiKeyDraft>, 'permissions'> & { permissions?: ApiKeyPermission[] | Partial<ApiKeyPermissionsState> }
  editing?: boolean
  submitting?: boolean
}>(), {
  initial: undefined,
  editing: false,
  submitting: false,
})

const emit = defineEmits<{
  submit: [draft: ApiKeyDraft]
  cancel: []
  clear: []
}>()

const emptyDraft = (): ApiKeyDraft => ({
  name: '',
  campaignIds: [],
  permissions: makePermissions(),
  expiresAt: '',
})

const draft = reactive<ApiKeyDraft>(emptyDraft())
const submittedSnapshot = ref('')
const error = ref('')

const applyInitial = (initial?: { name?: string; campaignIds?: string[]; expiresAt?: string; permissions?: ApiKeyPermission[] | Partial<ApiKeyPermissionsState> }) => {
  const next = { ...emptyDraft(), ...initial, permissions: makePermissions(initial?.permissions) }
  Object.assign(draft, next)
  submittedSnapshot.value = JSON.stringify(draft)
  error.value = ''
}

watch(() => props.initial, value => applyInitial(value), { immediate: true, deep: true })

const dirty = computed(() => JSON.stringify(draft) !== submittedSnapshot.value)
const hasPermission = computed(() => apiKeyResources.some(({ key }) => draft.permissions[key].read || draft.permissions[key].write))

const submit = () => {
  error.value = ''
  if (!draft.name.trim()) {
    error.value = 'Enter a name for this API key.'
    return
  }
  if (!draft.campaignIds.length) {
    error.value = 'Select at least one campaign.'
    return
  }
  if (!hasPermission.value) {
    error.value = 'Choose at least one read or write permission.'
    return
  }

  emit('submit', {
    name: draft.name.trim(),
    campaignIds: [...draft.campaignIds],
    permissions: makePermissions(draft.permissions),
    expiresAt: draft.expiresAt || '',
  })
}

const markSubmitted = () => {
  submittedSnapshot.value = JSON.stringify(draft)
}

const reset = () => applyInitial(props.initial)

defineExpose({ dirty, markSubmitted, reset })
</script>

<template>
  <UForm :state="draft" :disabled="submitting || !campaigns.length" class="space-y-6" @submit="submit">
    <UFormField label="Key name" name="name" description="Use a name that identifies the agent or integration.">
      <UInput v-model="draft.name" class="w-full" autocomplete="off" placeholder="Campaign assistant" :disabled="submitting" />
    </UFormField>

    <UFormField label="Campaign access" name="campaignIds" description="The key can only access campaigns selected here.">
      <USelectMenu
        v-model="draft.campaignIds"
        :items="campaigns"
        value-key="id"
        label-key="name"
        multiple
        searchable
        class="w-full"
        aria-label="Campaign access"
        placeholder="Select campaigns"
        :disabled="submitting"
      />
    </UFormField>

    <fieldset class="space-y-3">
      <legend class="type-record">Resource permissions</legend>
      <p class="text-sm text-muted">Read and write access are independent. The server applies your current campaign access as well.</p>
      <div class="rounded-md border border-default">
        <table class="w-full table-fixed text-sm">
          <caption class="sr-only">API key resource permissions</caption>
          <thead class="border-b border-default bg-muted/30 text-left text-xs uppercase tracking-[0.08em] text-dimmed">
            <tr>
              <th scope="col" class="w-[60%] px-3 py-2 font-medium">Resource</th>
              <th scope="col" class="w-16 px-2 py-2 text-center font-medium sm:w-24 sm:px-3">Read<span class="sr-only"> access</span></th>
              <th scope="col" class="w-16 px-2 py-2 text-center font-medium sm:w-24 sm:px-3">Write<span class="sr-only"> access</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="resource in apiKeyResources" :key="resource.key">
              <th scope="row" class="break-words px-3 py-3 text-left font-medium text-highlighted">
                <span class="block">{{ resource.label }}</span>
                <span class="hidden text-xs font-normal text-muted sm:block">{{ resource.description }}</span>
              </th>
              <td class="px-3 py-3 text-center">
                <USwitch v-model="draft.permissions[resource.key].read" :aria-label="`Allow ${resource.label} read access`" :disabled="submitting" />
              </td>
              <td class="px-3 py-3 text-center">
                <USwitch v-model="draft.permissions[resource.key].write" :aria-label="`Allow ${resource.label} write access`" :disabled="submitting" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </fieldset>

    <UFormField label="Expiration (optional)" name="expiresAt" description="Leave blank for a key with no expiration date. Existing times are preserved when unchanged.">
      <UInput v-model="draft.expiresAt" type="datetime-local" class="w-full sm:max-w-xs" :disabled="submitting" />
    </UFormField>

    <UAlert v-if="error" color="error" variant="subtle" :description="error" role="alert" />

    <div class="flex flex-wrap items-center justify-end gap-2 border-t border-default pt-4">
      <UButton v-if="editing" type="button" color="neutral" variant="ghost" :disabled="submitting" @click="emit('cancel')">Cancel</UButton>
      <UButton v-else-if="dirty" type="button" color="neutral" variant="ghost" :disabled="submitting" @click="emit('clear')">Clear draft</UButton>
      <UButton type="submit" color="primary" variant="solid" icon="i-lucide-key-round" :loading="submitting" :disabled="!campaigns.length">
        {{ editing ? 'Save changes' : 'Create API key' }}
      </UButton>
    </div>
  </UForm>
</template>
