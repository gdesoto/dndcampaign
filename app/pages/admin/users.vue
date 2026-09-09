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
  { accessorKey: 'isActive', header: 'Active' },
  { accessorKey: 'lastLoginAt', header: 'Last login' },
  { accessorKey: 'ownedCampaignCount', header: 'Owned campaigns', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { accessorKey: 'memberCampaignCount', header: 'Member campaigns', meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } } },
  { id: 'actions', header: 'Actions', meta: { class: { th: 'w-px', td: 'w-px whitespace-nowrap' } } },
]

const selectedUser = computed(() =>
  users.value.find((user) => user.id === action.selectedUserId) || null
)

const userOptions = computed(() =>
  users.value.map((user) => ({
    label: `${user.name} (${user.email})`,
    value: user.id,
  }))
)

watch(
  selectedUser,
  (value) => {
    if (!value) return
    action.systemRole = value.systemRole
    action.isActive = value.isActive
  },
  { immediate: true }
)

watch(
  users,
  (list) => {
    if (!list.length) {
      action.selectedUserId = ''
      return
    }

    const exists = list.some((user) => user.id === action.selectedUserId)
    if (!exists) {
      action.selectedUserId = list[0]?.id || ''
    }
  },
  { immediate: true }
)

const refreshUsers = async () => {
  action.error = ''
  action.success = ''
  await refresh()
}

const saveUser = async () => {
  if (!action.selectedUserId || action.saving) return

  action.error = ''
  action.success = ''
  action.saving = true

  try {
    await admin.updateUser(action.selectedUserId, {
      systemRole: action.systemRole,
      isActive: action.isActive,
    })
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

const editRecord = (id: string) => {
  action.selectedUserId = id
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

          <div class="grid gap-3 md:grid-cols-4">
            <UInput v-model="filters.search" aria-label="Search users" placeholder="Name or email" />
            <USelect
v-model="filters.status"
              aria-label="Status"
              :items="[
                { label: 'All statuses', value: 'all' },
                { label: 'Active only', value: 'active' },
                { label: 'Inactive only', value: 'inactive' },
              ]"
            />
            <USelect
v-model="filters.role"
              aria-label="Role"
              :items="[
                { label: 'All roles', value: 'all' },
                { label: 'Users', value: 'USER' },
                { label: 'System admins', value: 'SYSTEM_ADMIN' },
              ]"
            />
            <UButton :loading="pending" @click="refreshUsers">Refresh</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Users</h2>
              <UBadge color="neutral" variant="subtle">{{ usersData?.total || 0 }} total</UBadge>
            </div>
          </template>

          <SharedResponsiveTable

            :data="users.map((user) => ({ ...user, isActive: user.isActive ? 'Yes' : 'No', lastLoginAt: formatLastLogin(user.lastLoginAt) }))"
            :columns="userColumns"
            :loading="pending"
            empty="No users found"
          ><template #actions-cell="{ row }"><UButton color="neutral" variant="ghost" icon="i-lucide-pencil" @click="editRecord(row.original.id)">Edit</UButton></template></SharedResponsiveTable>

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
            <USelect v-model="action.selectedUserId" aria-label="User" :disabled="action.saving" :items="userOptions" />
            <USelect v-model="action.systemRole" aria-label="System role" :disabled="action.saving" :items="roleOptions" />
            <USwitch v-model="action.isActive" :disabled="action.saving" label="User is active" />
            <UButton :loading="action.saving" @click="saveUser">Save user</UButton>
          </div>

          <p v-if="action.success" class="mt-3 text-sm text-success">{{ action.success }}</p>
          <p v-if="action.error" class="mt-3 text-sm text-error">{{ action.error }}</p>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
