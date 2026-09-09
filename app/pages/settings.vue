<script setup lang="ts">
import { z } from 'zod'
const profileSchema = z.object({ name: z.string().trim().min(1, 'Enter a display name.'), avatarUrl: z.union([z.literal(''), z.url('Enter a valid URL.')]) })
const emailSchema = z.object({ newEmail: z.email('Enter a valid email.'), password: z.string().min(1, 'Enter your current password.') })
const passwordSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password.'), newPassword: z.string().min(10, 'Use at least 10 characters.') })
definePageMeta({ layout: 'default' })

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
  error: profileError,
  refresh: refreshProfile,
} = await useAsyncData<AccountProfile | null>('account-profile', async () => {
  const response = await account.getProfile()
  if (!response) throw new Error('Unable to load profile.')
  return response.profile
})

const {
  data: sessions,
  pending: sessionsPending,
  error: sessionsError,
  refresh: refreshSessions,
} = await useAsyncData('account-sessions', async () => {
  const response = await account.listSessions()
  if (!response) throw new Error('Unable to load sessions.')
  return response.sessions
})

const previousProfile = reactive({ name: '', avatarUrl: '', email: '' })
watch(
  profile,
  (value) => {
    if (!value) return
    if (!profile.value || profileForm.name === '' || profileForm.name === previousProfile.name) profileForm.name = value.name
    if (profileForm.avatarUrl === previousProfile.avatarUrl) profileForm.avatarUrl = value.avatarUrl || ''
    if (!emailForm.newEmail || emailForm.newEmail === previousProfile.email) emailForm.newEmail = value.email
    Object.assign(previousProfile, { name: value.name, avatarUrl: value.avatarUrl || '', email: value.email })
  },
  { immediate: true }
)

const saveProfile = async () => {
  if (accountBusy.value) return
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
  if (accountBusy.value) return
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
  if (accountBusy.value) return
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
    revokeAction.success = `Revoked ${response?.revokedSessions ?? 0} other sessions.`
  } catch (error) {
    revokeAction.error =
      (error as Error & { message?: string }).message || 'Unable to revoke other sessions.'
  } finally {
    revokeAction.running = false
  }
}

const accountBusy = computed(() => profileAction.saving || emailAction.saving || passwordAction.saving)
useUnsavedChanges(() => Boolean(profile.value) && (profileForm.name !== previousProfile.name || profileForm.avatarUrl !== previousProfile.avatarUrl || emailForm.newEmail !== previousProfile.email || Boolean(emailForm.password || passwordForm.currentPassword || passwordForm.newPassword)), accountBusy)
</script>

<template>
  <UPage>
    <UPageHeader headline="Account" title="Settings" />

    <UMain>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.08em] text-dimmed">Profile</p>
                <h2 class="mt-1 type-section">Account profile</h2>
              </div>
              <UBadge color="neutral" variant="subtle">{{ profile?.systemRole || 'USER' }}</UBadge>
            </div>
          </template>

          <div v-if="profilePending && !profile" class="space-y-3">
            <div class="h-4 w-40 animate-pulse rounded bg-muted"/>
            <div class="h-10 w-full animate-pulse rounded bg-muted"/>
            <div class="h-10 w-full animate-pulse rounded bg-muted"/>
          </div>

          <div v-else-if="profileError" class="space-y-3"><UAlert color="error" title="Unable to load profile" /><UButton @click="() => refreshProfile()">Retry</UButton></div>
          <UForm v-else :state="profileForm" :schema="profileSchema" :disabled="accountBusy" class="space-y-4" @submit="saveProfile">
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Display name" name="name"><UInput v-model="profileForm.name" placeholder="Display name"  /></UFormField>
              <UFormField label="Avatar URL (optional)" name="avatarUrl"><UInput v-model="profileForm.avatarUrl" placeholder="https://..."  /></UFormField>
            </div>
            <p class="text-xs text-muted">Email: {{ profile?.email }}</p>
            <div class="flex flex-wrap items-center gap-3">
              <UButton :loading="profileAction.saving" type="submit" color="primary" variant="solid">Save profile</UButton>
              <p v-if="profileAction.success" class="text-sm text-success">{{ profileAction.success }}</p>
              <p v-if="profileAction.error" class="text-sm text-error">{{ profileAction.error }}</p>
            </div>
          </UForm>
        </UCard>

        <UCard>
          <template #header>
            <h2 class=" type-section">Security</h2>
          </template>

          <div class="space-y-6">
            <UForm :state="emailForm" :schema="emailSchema" :disabled="accountBusy" class="space-y-3" @submit="saveEmail">
              <h3 class=" type-record">Change email</h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="New email" name="newEmail"><UInput v-model="emailForm.newEmail" type="email" placeholder="you@example.com"  /></UFormField>
                <UFormField label="Current password" name="password"><UInput v-model="emailForm.password" type="password" placeholder="••••••••••"  /></UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <UButton :loading="emailAction.saving" type="submit" color="primary" variant="solid">Update email</UButton>
                <p v-if="emailAction.success" class="text-sm text-success">{{ emailAction.success }}</p>
                <p v-if="emailAction.error" class="text-sm text-error">{{ emailAction.error }}</p>
              </div>
            </UForm>

            <USeparator />

            <UForm :state="passwordForm" :schema="passwordSchema" :disabled="accountBusy" class="space-y-3" @submit="savePassword">
              <h3 class=" type-record">Change password</h3>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Current password" name="currentPassword"><UInput
id="field-settings-vue-5"
                    v-model="passwordForm.currentPassword"
                    type="password"
                    placeholder="••••••••••"
                   /></UFormField>
                <UFormField label="New password" name="newPassword"><UInput v-model="passwordForm.newPassword" type="password" placeholder="••••••••••"  /></UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <UButton :loading="passwordAction.saving" type="submit" color="primary" variant="solid">Update password</UButton>
                <p v-if="passwordAction.success" class="text-sm text-success">{{ passwordAction.success }}</p>
                <p v-if="passwordAction.error" class="text-sm text-error">{{ passwordAction.error }}</p>
              </div>
            </UForm>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class=" type-section">Active sessions</h2>
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
              <div class="h-9 w-full animate-pulse rounded bg-muted"/>
              <div class="h-9 w-full animate-pulse rounded bg-muted"/>
            </div>

            <div v-else-if="sessionsError" class="space-y-3"><UAlert color="error" title="Unable to load active sessions" /><UButton @click="() => refreshSessions()">Retry</UButton></div>
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

      </div>
    </UMain>
  </UPage>
</template>
