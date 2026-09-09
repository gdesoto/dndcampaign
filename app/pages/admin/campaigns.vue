<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const admin = useAdmin()
const toast = useToast()

const page = ref(1)
const pageSize = 25
const filters = reactive({
  search: '',
  archived: 'all' as 'all' | 'active' | 'archived',
})

watch(filters, () => { page.value = 1 }, { flush: 'sync' })

const action = reactive({
  selectedCampaignId: '',
  isArchived: false,
  transferOwnerUserId: '',
  transferOwnerSearch: '',
  transferOwnerSearchLoading: false,
  savingArchive: false,
  savingTransfer: false,
  error: '',
  success: '',
})

const {
  data: campaignsData,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `admin-campaigns-${filters.search}-${filters.archived}-${page.value}`,
  () =>
    admin.getCampaigns({
      search: filters.search || undefined,
      archived: filters.archived,
      page: page.value,
      pageSize,
    })
)

const campaigns = computed(() => campaignsData.value?.campaigns || [])

const campaignColumns: TableColumn<{
  id: string
  name: string
  ownerEmail: string
  isArchived: string
  memberCount: number
  sessionCount: number
  documentCount: number
  updatedAt: string
}>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'ownerEmail', header: 'Owner email' },
  { accessorKey: 'isArchived', header: 'Archived' },
  { accessorKey: 'memberCount', header: 'Members', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { accessorKey: 'sessionCount', header: 'Sessions', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { accessorKey: 'documentCount', header: 'Documents', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { accessorKey: 'updatedAt', header: 'Updated' },
  {
    id: 'openCampaign',
    header: 'Campaign',
    meta: {
      class: {
        td: 'text-right',
      },
    },
  },
]

const campaignOptions = computed(() =>
  campaigns.value.map((campaign) => ({
    label: `${campaign.name} (${campaign.owner.email})`,
    value: campaign.id,
  }))
)

const selectedCampaign = computed(() =>
  campaigns.value.find((campaign) => campaign.id === action.selectedCampaignId) || null
)

const transferOwnerUserOptions = ref<Array<{ label: string; value: string }>>([])
let transferOwnerSearchTimer: ReturnType<typeof setTimeout> | null = null

const loadTransferOwnerOptions = async (search?: string) => {
  action.transferOwnerSearchLoading = true
  try {
    const response = await admin.getUsers({
      search: search?.trim() || undefined,
      page: 1,
      pageSize: 20,
      status: 'active',
      role: 'all',
    })

    if (!response) {
      transferOwnerUserOptions.value = []
      return
    }

    transferOwnerUserOptions.value = response.users.map((user) => ({
      label: `${user.name} (${user.email})`,
      value: user.id,
    }))
  } catch {
    transferOwnerUserOptions.value = []
  } finally {
    action.transferOwnerSearchLoading = false
  }
}

const queueTransferOwnerSearch = (value: string) => {
  action.transferOwnerSearch = value
  if (transferOwnerSearchTimer) {
    clearTimeout(transferOwnerSearchTimer)
  }

  transferOwnerSearchTimer = setTimeout(() => {
    loadTransferOwnerOptions(value)
  }, 250)
}

watch(
  campaigns,
  (list) => {
    if (!list.length) {
      action.selectedCampaignId = ''
      return
    }

    const exists = list.some((campaign) => campaign.id === action.selectedCampaignId)
    if (!exists) {
      action.selectedCampaignId = list[0]?.id || ''
    }
  },
  { immediate: true }
)

watch(
  selectedCampaign,
  (campaign) => {
    if (!campaign) return
    action.isArchived = campaign.isArchived
  },
  { immediate: true }
)

onMounted(async () => {
  await loadTransferOwnerOptions('')
})

onBeforeUnmount(() => {
  if (transferOwnerSearchTimer) {
    clearTimeout(transferOwnerSearchTimer)
  }
})

const refreshCampaigns = async () => {
  action.error = ''
  action.success = ''
  await refresh()
}

const saveArchiveStatus = async () => {
  if (!action.selectedCampaignId || action.savingArchive || action.savingTransfer) return
  const id = action.selectedCampaignId
  const previous = selectedCampaign.value?.isArchived ?? false
  const name = selectedCampaign.value?.name || 'Campaign'

  action.error = ''
  action.success = ''
  action.savingArchive = true

  try {
    await admin.updateCampaign(id, { isArchived: action.isArchived })
    action.success = 'Campaign status updated.'
    toast.add({ title: `${name} ${action.isArchived ? 'archived' : 'restored'}`, color: 'success', duration: 8000, actions: [{ label: 'Undo', onClick: async () => {
      try { await admin.updateCampaign(id, { isArchived: previous }); await refresh() }
      catch (error) { toast.add({ title: 'Unable to undo', description: (error as Error).message, color: 'error', duration: 0 }) }
    } }] })
    await refresh()
  } catch (saveError) {
    action.error = (saveError as Error).message || 'Unable to update campaign status.'
  } finally {
    action.savingArchive = false
  }
}

const transferOwner = async () => {
  if (action.savingTransfer || action.savingArchive) return
  if (!action.selectedCampaignId || !action.transferOwnerUserId.trim()) {
    action.error = 'Target owner user id is required.'
    return
  }

  action.error = ''
  action.success = ''
  action.savingTransfer = true

  try {
    await admin.updateCampaign(action.selectedCampaignId, {
      transferOwnerUserId: action.transferOwnerUserId.trim(),
    })
    action.success = 'Campaign ownership transferred.'
    action.transferOwnerUserId = ''
    action.transferOwnerSearch = ''
    await refresh()
  } catch (saveError) {
    action.error = (saveError as Error).message || 'Unable to transfer campaign ownership.'
  } finally {
    action.savingTransfer = false
  }
}

const editRecord = (id: string) => {
  action.selectedCampaignId = id
  nextTick(() => { const heading = document.querySelector<HTMLElement>('#record-editor h2'); heading?.scrollIntoView({ block: 'center', behavior: 'instant' }); heading?.focus() })
}
const adminBreadcrumbItems = [
  { label: 'Admin', to: '/admin' },
  { label: 'Campaign management' },
]
</script>

<template>
  <UPage>
    <UPageHeader headline="Admin" title="Campaign management">
      <template #default>
        <UBreadcrumb :items="adminBreadcrumbItems" />
      </template>
    </UPageHeader>

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Search campaigns</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-3">
            <UInput v-model="filters.search" aria-label="Search campaigns" placeholder="Campaign name or description" />
            <USelect
v-model="filters.archived"
              aria-label="Campaign status"
              :items="[
                { label: 'All campaigns', value: 'all' },
                { label: 'Active only', value: 'active' },
                { label: 'Archived only', value: 'archived' },
              ]"
            />
            <UButton :loading="pending" @click="refreshCampaigns">Refresh</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Campaigns</h2>
              <UBadge color="neutral" variant="subtle">{{ campaignsData?.total || 0 }} total</UBadge>
            </div>
          </template>

          <SharedResponsiveTable

            :data="campaigns.map((campaign) => ({
              ...campaign,
              ownerEmail: campaign.owner.email,
              isArchived: campaign.isArchived ? 'Yes' : 'No',
              updatedAt: new Date(campaign.updatedAt).toLocaleString(),
            }))"
            :columns="campaignColumns"
            :loading="pending"
            empty="No campaigns found"
          >
            <template #name-cell="{ row }"><NuxtLink :to="`/campaigns/${row.original.id}`" class="font-semibold">{{ row.original.name }}</NuxtLink></template>
            <template #openCampaign-cell="{ row }">
              <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" @click="editRecord(row.original.id)">Edit</UButton>
              <UButton
                :to="`/campaigns/${row.original.id}`"
                variant="ghost"
                size="xs"
                icon="i-lucide-external-link"
                label="Open campaign"
              />
            </template>
          </SharedResponsiveTable>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-muted">{{ campaignsData?.total ? (page - 1) * pageSize + 1 : 0 }}–{{ Math.min(page * pageSize, campaignsData?.total || 0) }} of {{ campaignsData?.total || 0 }}</p>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="campaignsData?.total || 0" :disabled="pending" />
          </div>
          <UButton v-if="!campaigns.length && !pending && !error && filters.search" color="neutral" variant="outline" @click="filters.search = ''">Clear search</UButton>
          <p v-if="error" class="mt-3 text-sm text-error">{{ (error as Error).message }}</p>
        </UCard>

        <UCard id="record-editor">
          <template #header>
            <h2 tabindex="-1" class="text-lg font-semibold">Update campaign</h2>
          </template>

          <div class="space-y-4">
            <USelect v-model="action.selectedCampaignId" aria-label="Campaign" :disabled="action.savingTransfer || action.savingArchive" :items="campaignOptions" />

            <div class="grid gap-3 md:grid-cols-3">
              <UButton color="neutral" variant="outline" icon="i-lucide-archive" :disabled="!selectedCampaign || action.savingTransfer" :loading="action.savingArchive" @click="() => { action.isArchived = !selectedCampaign?.isArchived; saveArchiveStatus() }">{{ selectedCampaign?.isArchived ? 'Restore' : 'Archive' }}</UButton>
            </div>

            <div class="grid gap-3 md:grid-cols-[1fr_auto]">
              <USelectMenu
v-model="action.transferOwnerUserId"
                aria-label="New owner" :disabled="action.savingTransfer || action.savingArchive"
                value-key="value"
                label-key="label"
                :search-term="action.transferOwnerSearch"
                :loading="action.transferOwnerSearchLoading"
                :items="transferOwnerUserOptions"
                :search-input="{ placeholder: 'Search users by name or email' }"
                placeholder="Select new owner"
                @update:search-term="queueTransferOwnerSearch"
              />
              <SharedConfirmActionPopover trigger-label="Transfer ownership" :message="`Transfer ownership of ${selectedCampaign?.name || 'this campaign'} to the selected user? The current owner will lose ownership.`" confirm-label="Transfer ownership" :disabled="!action.transferOwnerUserId || action.savingArchive" :confirm-loading="action.savingTransfer" @confirm="async ({ close }) => { await transferOwner(); if (!action.error) close() }" />
            </div>

            <p v-if="action.success" class="text-sm text-success">{{ action.success }}</p>
            <p v-if="action.error" class="text-sm text-error">{{ action.error }}</p>
          </div>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
