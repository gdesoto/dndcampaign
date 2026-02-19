<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'app' })

const admin = useAdmin()

const filters = reactive({
  search: '',
  archived: 'all' as 'all' | 'active' | 'archived',
})

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
  () => `admin-campaigns-${filters.search}-${filters.archived}`,
  () =>
    admin.getCampaigns({
      search: filters.search || undefined,
      archived: filters.archived,
      page: 1,
      pageSize: 50,
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
  { accessorKey: 'memberCount', header: 'Members' },
  { accessorKey: 'sessionCount', header: 'Sessions' },
  { accessorKey: 'documentCount', header: 'Documents' },
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
  if (!action.selectedCampaignId) return

  action.error = ''
  action.success = ''
  action.savingArchive = true

  try {
    await admin.updateCampaign(action.selectedCampaignId, { isArchived: action.isArchived })
    action.success = 'Campaign status updated.'
    await refresh()
  } catch (saveError) {
    action.error = (saveError as Error).message || 'Unable to update campaign status.'
  } finally {
    action.savingArchive = false
  }
}

const transferOwner = async () => {
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
            <UInput v-model="filters.search" placeholder="Campaign name or description" />
            <USelect
              v-model="filters.archived"
              :items="[
                { label: 'All campaigns', value: 'all' },
                { label: 'Active only', value: 'active' },
                { label: 'Archived only', value: 'archived' },
              ]"
            />
            <UButton :loading="pending" @click="refreshCampaigns">Apply filters</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Campaigns</h2>
              <UBadge color="neutral" variant="subtle">{{ campaignsData?.total || 0 }} total</UBadge>
            </div>
          </template>

          <UTable
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
            <template #openCampaign-cell="{ row }">
              <UButton
                :to="`/campaigns/${row.original.id}`"
                variant="ghost"
                size="xs"
                icon="i-lucide-external-link"
                label="Open campaign"
              />
            </template>
          </UTable>

          <p v-if="error" class="mt-3 text-sm text-error">{{ (error as Error).message }}</p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Update campaign</h2>
          </template>

          <div class="space-y-4">
            <USelect v-model="action.selectedCampaignId" :items="campaignOptions" />

            <div class="grid gap-3 md:grid-cols-3">
              <USwitch v-model="action.isArchived" label="Campaign archived" />
              <UButton :loading="action.savingArchive" @click="saveArchiveStatus">Save status</UButton>
            </div>

            <div class="grid gap-3 md:grid-cols-[1fr_auto]">
              <USelectMenu
                v-model="action.transferOwnerUserId"
                value-key="value"
                label-key="label"
                :search-term="action.transferOwnerSearch"
                :loading="action.transferOwnerSearchLoading"
                :items="transferOwnerUserOptions"
                :search-input="{ placeholder: 'Search users by name or email' }"
                placeholder="Select new owner"
                @update:search-term="queueTransferOwnerSearch"
              />
              <UButton color="warning" :loading="action.savingTransfer" @click="transferOwner">
                Transfer owner
              </UButton>
            </div>

            <p v-if="action.success" class="text-sm text-success">{{ action.success }}</p>
            <p v-if="action.error" class="text-sm text-error">{{ action.error }}</p>
          </div>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
