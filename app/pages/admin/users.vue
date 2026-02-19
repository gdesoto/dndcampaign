<script setup lang="ts">
definePageMeta({ layout: 'app' })

const admin = useAdmin()

const filters = reactive({
  search: '',
  status: 'all' as 'all' | 'active' | 'inactive',
  role: 'all' as 'all' | 'USER' | 'SYSTEM_ADMIN',
})

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
  () => `admin-users-${filters.search}-${filters.status}-${filters.role}`,
  () =>
    admin.getUsers({
      search: filters.search || undefined,
      status: filters.status,
      role: filters.role,
      page: 1,
      pageSize: 50,
    })
)

const users = computed(() => usersData.value?.users || [])

const userColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'systemRole', header: 'Role' },
  { accessorKey: 'isActive', header: 'Active' },
  { accessorKey: 'lastLoginAt', header: 'Last login' },
  { accessorKey: 'ownedCampaignCount', header: 'Owned campaigns' },
  { accessorKey: 'memberCampaignCount', header: 'Member campaigns' },
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
  if (!action.selectedUserId) return

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
            <UInput v-model="filters.search" placeholder="Name or email" />
            <USelect
              v-model="filters.status"
              :items="[
                { label: 'All statuses', value: 'all' },
                { label: 'Active only', value: 'active' },
                { label: 'Inactive only', value: 'inactive' },
              ]"
            />
            <USelect
              v-model="filters.role"
              :items="[
                { label: 'All roles', value: 'all' },
                { label: 'Users', value: 'USER' },
                { label: 'System admins', value: 'SYSTEM_ADMIN' },
              ]"
            />
            <UButton :loading="pending" @click="refreshUsers">Apply filters</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Users</h2>
              <UBadge color="neutral" variant="subtle">{{ usersData?.total || 0 }} total</UBadge>
            </div>
          </template>

          <UTable
            :data="users.map((user) => ({ ...user, isActive: user.isActive ? 'Yes' : 'No', lastLoginAt: formatLastLogin(user.lastLoginAt) }))"
            :columns="userColumns"
            :loading="pending"
            empty="No users found"
          />

          <p v-if="error" class="mt-3 text-sm text-error">{{ (error as Error).message }}</p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Update user</h2>
          </template>

          <div class="grid gap-3 md:grid-cols-4">
            <USelect v-model="action.selectedUserId" :items="userOptions" />
            <USelect v-model="action.systemRole" :items="roleOptions" />
            <USwitch v-model="action.isActive" label="User is active" />
            <UButton :loading="action.saving" @click="saveUser">Save user</UButton>
          </div>

          <p v-if="action.success" class="mt-3 text-sm text-success">{{ action.success }}</p>
          <p v-if="action.error" class="mt-3 text-sm text-error">{{ action.error }}</p>
        </UCard>
      </div>
    </UMain>
  </UPage>
</template>
