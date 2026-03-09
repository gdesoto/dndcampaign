<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const admin = useAdmin()
const { formatBytes } = useFormatBytes()
const ALL_CAMPAIGNS_VALUE = '__all_campaigns__'

const filters = reactive({
  campaignId: ALL_CAMPAIGNS_VALUE,
  issuesOnly: true,
})

const state = reactive({
  fixingKey: '',
  success: '',
  error: '',
})

const {
  data: campaignsData,
  pending: campaignsPending,
} = await useAsyncData('admin-storage-audit-campaigns', () =>
  admin.getCampaigns({
    archived: 'all',
    page: 1,
    pageSize: 100,
  })
)

const campaignOptions = computed(() => [
  { label: 'All campaigns', value: ALL_CAMPAIGNS_VALUE },
  ...(campaignsData.value?.campaigns || []).map((campaign) => ({
    label: campaign.name,
    value: campaign.id,
  })),
])

const {
  data: auditData,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `admin-storage-audit-${filters.campaignId === ALL_CAMPAIGNS_VALUE ? 'all' : filters.campaignId}-${filters.issuesOnly ? 'issues' : 'all'}`,
  () =>
    admin.getStorageAudit({
      campaignId: filters.campaignId === ALL_CAMPAIGNS_VALUE ? undefined : filters.campaignId,
      issuesOnly: filters.issuesOnly,
    })
)

const summary = computed(() => auditData.value?.summary)
const artifactRows = computed(() => auditData.value?.artifactRows || [])
const orphanStorageRows = computed(() => auditData.value?.orphanStorageRows || [])
const documentRows = computed(() => auditData.value?.documentRows || [])

const artifactColumns: TableColumn<{
  artifactId: string
  campaignName: string
  storageKey: string
  status: string
  referencedCount: number
  byteSize: string
  createdAt: string
  fixActions: Array<'DELETE_UNREFERENCED_ARTIFACT'>
}>[] = [
  { accessorKey: 'campaignName', header: 'Campaign' },
  { accessorKey: 'storageKey', header: 'Storage key' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'referencedCount', header: 'Refs' },
  { accessorKey: 'byteSize', header: 'Size' },
  { accessorKey: 'createdAt', header: 'Created' },
  { id: 'actions', header: 'Actions' },
]

const orphanColumns: TableColumn<{
  storageKey: string
  campaignName: string
  byteSize: string
}>[] = [
  { accessorKey: 'campaignName', header: 'Campaign' },
  { accessorKey: 'storageKey', header: 'Storage key' },
  { accessorKey: 'byteSize', header: 'Size' },
  { id: 'actions', header: 'Actions' },
]

const documentColumns: TableColumn<{
  documentId: string
  campaignName: string
  title: string
  type: string
  status: string
  versionCount: number
  currentVersionId: string
  latestVersionId: string
  fixActions: Array<'REPAIR_DOCUMENT_CURRENT_VERSION' | 'DELETE_EMPTY_DOCUMENT'>
}>[] = [
  { accessorKey: 'campaignName', header: 'Campaign' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'versionCount', header: 'Versions' },
  { accessorKey: 'currentVersionId', header: 'Current version' },
  { accessorKey: 'latestVersionId', header: 'Latest version' },
  { id: 'actions', header: 'Actions' },
]

const runAudit = async () => {
  state.error = ''
  state.success = ''
  await refresh()
}

const runFix = async (
  key: string,
  payload:
    | { action: 'DELETE_ORPHAN_STORAGE_FILE'; storageKey: string }
    | { action: 'DELETE_UNREFERENCED_ARTIFACT'; artifactId: string }
    | { action: 'REPAIR_DOCUMENT_CURRENT_VERSION'; documentId: string }
    | { action: 'DELETE_EMPTY_DOCUMENT'; documentId: string }
) => {
  state.error = ''
  state.success = ''
  state.fixingKey = key
  try {
    const result = await admin.applyStorageAuditFix(payload)
    if (!result) {
      throw new Error('No response from storage audit fix action.')
    }
    state.success = result.message
    await refresh()
  } catch (fixError) {
    state.error = (fixError as Error).message || 'Unable to apply fix.'
  } finally {
    state.fixingKey = ''
  }
}

const statusColor = (status: string) => {
  if (status === 'OK') return 'success'
  if (status === 'UNREFERENCED') return 'warning'
  if (status === 'EMPTY') return 'warning'
  return 'error'
}

const adminBreadcrumbItems = [
  { label: 'Admin', to: '/admin' },
  { label: 'Storage audit' },
]
</script>

<template>
  <UPage>
    <UPageHeader headline="Admin" title="Storage audit">
      <template #default>
        <UBreadcrumb :items="adminBreadcrumbItems" />
      </template>
    </UPageHeader>

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Audit scope</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <USelect
              v-model="filters.campaignId"
              :items="campaignOptions"
              :loading="campaignsPending"
              placeholder="Choose a campaign"
            />
            <USwitch v-model="filters.issuesOnly" label="Only show issues" />
            <UButton :loading="pending" @click="runAudit">Run audit</UButton>
          </div>
        </UCard>

        <div class="grid gap-4 md:grid-cols-4">
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Total issues</p>
            <p class="mt-2 text-2xl font-semibold">{{ summary?.totalIssues ?? 0 }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Fixable issues</p>
            <p class="mt-2 text-2xl font-semibold">{{ summary?.fixableIssues ?? 0 }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Artifacts missing files</p>
            <p class="mt-2 text-2xl font-semibold">{{ summary?.artifacts.missingFile ?? 0 }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-muted">Orphan storage files</p>
            <p class="mt-2 text-2xl font-semibold">{{ summary?.storage.orphanFiles ?? 0 }}</p>
          </UCard>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Audit failed"
          :description="(error as Error).message || 'Unable to run storage audit.'"
        />

        <UAlert
          v-if="auditData?.warnings?.length"
          color="warning"
          variant="subtle"
          title="Warnings"
          :description="auditData.warnings.join(' ')"
        />

        <UAlert v-if="state.success" color="success" variant="subtle" :description="state.success" />
        <UAlert v-if="state.error" color="error" variant="subtle" :description="state.error" />

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Artifact integrity</h2>
              <UBadge color="neutral" variant="subtle">{{ artifactRows.length }} rows</UBadge>
            </div>
          </template>

          <UTable
            :columns="artifactColumns"
            :data="
              artifactRows.map((row) => ({
                ...row,
                campaignName: row.campaignName || row.campaignId || 'Global',
                byteSize: formatBytes(row.byteSize),
                createdAt: new Date(row.createdAt).toLocaleString(),
              }))
            "
            :loading="pending"
            empty="No artifact rows in this scope."
          >
            <template #status-cell="{ row }">
              <UBadge :color="statusColor(row.original.status)" variant="soft">
                {{ row.original.status }}
              </UBadge>
            </template>
            <template #actions-cell="{ row }">
              <UButton
                v-if="row.original.fixActions.includes('DELETE_UNREFERENCED_ARTIFACT')"
                size="xs"
                color="warning"
                variant="ghost"
                :loading="state.fixingKey === `artifact-${row.original.artifactId}`"
                @click="
                  runFix(
                    `artifact-${row.original.artifactId}`,
                    {
                      action: 'DELETE_UNREFERENCED_ARTIFACT',
                      artifactId: row.original.artifactId,
                    }
                  )
                "
              >
                Delete unreferenced
              </UButton>
              <span v-else class="text-xs text-muted">No auto-fix</span>
            </template>
          </UTable>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Orphan storage files</h2>
              <UBadge color="neutral" variant="subtle">{{ orphanStorageRows.length }} rows</UBadge>
            </div>
          </template>

          <UTable
            :columns="orphanColumns"
            :data="
              orphanStorageRows.map((row) => ({
                ...row,
                campaignName: row.campaignName || row.campaignId || 'Unscoped',
                byteSize: formatBytes(row.byteSize),
              }))
            "
            :loading="pending"
            empty="No orphaned storage files in this scope."
          >
            <template #actions-cell="{ row }">
              <UButton
                size="xs"
                color="warning"
                variant="ghost"
                :loading="state.fixingKey === `orphan-${row.original.storageKey}`"
                @click="
                  runFix(
                    `orphan-${row.original.storageKey}`,
                    {
                      action: 'DELETE_ORPHAN_STORAGE_FILE',
                      storageKey: row.original.storageKey,
                    }
                  )
                "
              >
                Delete file
              </UButton>
            </template>
          </UTable>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Document integrity</h2>
              <UBadge color="neutral" variant="subtle">{{ documentRows.length }} rows</UBadge>
            </div>
          </template>

          <UTable
            :columns="documentColumns"
            :data="
              documentRows.map((row) => ({
                ...row,
                campaignName: row.campaignName || row.campaignId,
                currentVersionId: row.currentVersionId || '-',
                latestVersionId: row.latestVersionId || '-',
              }))
            "
            :loading="pending"
            empty="No document rows in this scope."
          >
            <template #status-cell="{ row }">
              <UBadge :color="statusColor(row.original.status)" variant="soft">
                {{ row.original.status }}
              </UBadge>
            </template>
            <template #actions-cell="{ row }">
              <UButton
                v-if="row.original.fixActions.includes('REPAIR_DOCUMENT_CURRENT_VERSION')"
                size="xs"
                color="primary"
                variant="ghost"
                :loading="state.fixingKey === `document-repair-${row.original.documentId}`"
                @click="
                  runFix(
                    `document-repair-${row.original.documentId}`,
                    {
                      action: 'REPAIR_DOCUMENT_CURRENT_VERSION',
                      documentId: row.original.documentId,
                    }
                  )
                "
              >
                Repair current version
              </UButton>
              <UButton
                v-else-if="row.original.fixActions.includes('DELETE_EMPTY_DOCUMENT')"
                size="xs"
                color="warning"
                variant="ghost"
                :loading="state.fixingKey === `document-delete-${row.original.documentId}`"
                @click="
                  runFix(
                    `document-delete-${row.original.documentId}`,
                    {
                      action: 'DELETE_EMPTY_DOCUMENT',
                      documentId: row.original.documentId,
                    }
                  )
                "
              >
                Delete empty document
              </UButton>
              <span v-else class="text-xs text-muted">No action</span>
            </template>
          </UTable>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
