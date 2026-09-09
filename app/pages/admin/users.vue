<script setup lang="ts">
definePageMeta({ layout: 'default' })

const admin = useAdmin()

const page = ref(1)
const pageSize = 25
const filters = reactive({
  search: '',
  status: 'all' as 'all' | 'active' | 'inactive',
  role: 'all' as 'all' | 'USER' | 'SYSTEM_ADMIN',
})

watch(filters, () => { page.value = 1 }, { flush: 'sync' })

const action = reactive({
  selectedUserId: '',
  systemRole: 'USER' as 'USER' | 'SYSTEM_ADMIN',
  isActive: true,
  saving: false,
  error: '',
  success: '',
})

const {
  data: usersData,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `admin-users-${filters.search}-${filters.status}-${filters.role}-${page.value}`,
  () =>
    admin.getUsers({
      search: filters.search || undefined,
      status: filters.status,
      role: filters.role,
      page: page.value,
      pageSize,
    })
)

const users = computed(() => usersData.value?.users || [])

const userColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'systemRole', header: 'Role' },
  { accessorKey: 'isActive', header: 'Status' },
  { accessorKey: 'lastLoginAt', header: 'Last login' },
  { accessorKey: 'ownedCampaignCount', header: 'Owned campaigns', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { accessorKey: 'memberCampaignCount', header: 'Member campaigns', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { id: 'actions', header: 'Actions', meta: { class: { th: 'w-px', td: 'w-px whitespace-nowrap' } } },
]

const selectedUser = shallowRef<(typeof users.value)[number] | null>(null)
const userDraft = useEditorDraft(
  () => ({ systemRole: action.systemRole, isActive: action.isActive }),
  value => Object.assign(action, value),
)
const { confirmDiscard } = useUnsavedChanges(userDraft.dirty, () => action.saving)
const userOptions = computed(() => {
  const available = [...users.value]
  if (selectedUser.value && !available.some(user => user.id === selectedUser.value?.id)) available.unshift(selectedUser.value)
  return available.map(user => ({ label: `${user.name} (${user.email})`, value: user.id }))
})
const loadUser = (user: (typeof users.value)[number]) => {
  selectedUser.value = user
  action.selectedUserId = user.id
  userDraft.sync({ systemRole: user.systemRole, isActive: user.isActive }, user.id)
}
watch(users, list => {
  if (action.saving) return
  const current = list.find(user => user.id === action.selectedUserId)
  if (current) loadUser(current)
  else if (!selectedUser.value && list[0]) loadUser(list[0])
  // Keep the editor bound to its record when filters or pagination hide it.
}, { immediate: true })
const selectUser = async (id: string) => {
  if (id === action.selectedUserId || !await confirmDiscard()) return
  const user = users.value.find(item => item.id === id)
  if (!user || action.saving) return
  loadUser(user)
  action.error = ''
  action.success = ''
}
const selectedUserModel = computed({
  get: () => action.selectedUserId,
  set: (id: string) => { void selectUser(id) },
})

const refreshUsers = async () => {
  action.error = ''
  action.success = ''
  await refresh()
}

const saveUser = async () => {
  if (!action.selectedUserId || action.saving) return

  action.error = ''
  action.success = ''
  const submitted = userDraft.snapshot()
  const userId = action.selectedUserId
  action.saving = true

  try {
    await admin.updateUser(userId, submitted)
    userDraft.accept(submitted)
    action.success = 'User updated successfully.'
    await refresh()
  } catch (saveError) {
    action.error = (saveError as Error).message || 'Unable to update user.'
  } finally {
    action.saving = false
  }
}

const formatLastLogin = (value: string | null) => (value ? new Date(value).toLocaleString() : 'Never')

const roleOptions = [
  { label: 'User', value: 'USER' },
  { label: 'System admin', value: 'SYSTEM_ADMIN' },
]

const editRecord = async (id: string) => {
  await selectUser(id)
  if (action.selectedUserId !== id) return
  nextTick(() => { const heading = document.querySelector<HTMLElement>('#record-editor h2'); heading?.scrollIntoView({ block: 'center', behavior: 'instant' }); heading?.focus() })
}
const adminBreadcrumbItems = [
  { label: 'Admin', to: '/admin' },
  { label: 'User management' },
]
</script>

<template>
  <UPage>
    <UPageHeader headline="Admin" title="User management">
      <template #default>
        <UBreadcrumb :items="adminBreadcrumbItems" />
      </template>
    </UPageHeader>

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Search users</h2>
          </template>

          <SharedFilterToolbar label="Filter users">
            <UFormField label="Search users">
              <UInput v-model="filters.search" placeholder="Name or email" icon="i-lucide-search" class="w-full" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="filters.status"
                :items="[
                { label: 'All statuses', value: 'all' },
                { label: 'Active only', value: 'active' },
                { label: 'Inactive only', value: 'inactive' },
              ]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Role">
              <USelect
                v-model="filters.role"
                :items="[
                { label: 'All roles', value: 'all' },
                { label: 'Users', value: 'USER' },
                { label: 'System admins', value: 'SYSTEM_ADMIN' },
              ]"
                class="w-full"
              />
            </UFormField>
            <template #actions>
              <UButton :loading="pending" @click="refreshUsers">Refresh</UButton>
            </template>
          </SharedFilterToolbar>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Users</h2>
              <UBadge color="neutral" variant="subtle">{{ usersData?.total || 0 }} total</UBadge>
            </div>
          </template>

          <SharedResponsiveTable
            identity-column="name" status-column="isActive"

            :data="users.map((user) => ({ ...user, isActive: user.isActive ? 'Yes' : 'No', lastLoginAt: formatLastLogin(user.lastLoginAt) }))"
            :columns="userColumns"
            :loading="pending"
            empty="No users found"
          >
            <template #isActive-cell="{ row }"><UBadge :color="row.original.isActive === 'Yes' ? 'success' : 'neutral'" variant="subtle">{{ row.original.isActive === 'Yes' ? 'Active' : 'Inactive' }}</UBadge></template>
            <template #actions-cell="{ row }"><UButton color="neutral" variant="ghost" icon="i-lucide-pencil" @click="editRecord(row.original.id)">Edit</UButton></template></SharedResponsiveTable>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-muted">{{ usersData?.total ? (page - 1) * pageSize + 1 : 0 }}–{{ Math.min(page * pageSize, usersData?.total || 0) }} of {{ usersData?.total || 0 }}</p>
            <UPagination v-model:page="page" :items-per-page="pageSize" :total="usersData?.total || 0" :disabled="pending" />
          </div>
          <UButton v-if="!users.length && !pending && !error && filters.search" color="neutral" variant="outline" @click="filters.search = ''">Clear search</UButton>
          <p v-if="error" class="mt-3 text-sm text-error">{{ (error as Error).message }}</p>
        </UCard>

        <UCard id="record-editor">
          <template #header>
            <h2 tabindex="-1" class="text-lg font-semibold">Update user</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-4">
            <USelect v-model="selectedUserModel" aria-label="User" :disabled="action.saving" :items="userOptions" />
            <USelect v-model="action.systemRole" aria-label="System role" :disabled="action.saving" :items="roleOptions" />
            <USwitch v-model="action.isActive" :disabled="action.saving" label="User is active" />
            <UButton :disabled="!selectedUser || !userDraft.dirty.value" :loading="action.saving" @click="saveUser">Save user</UButton>
          </div>

          <p v-if="action.success" class="mt-3 text-sm text-success">{{ action.success }}</p>
          <p v-if="action.error" class="mt-3 text-sm text-error">{{ action.error }}</p>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
