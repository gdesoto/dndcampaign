<script setup lang="ts">
import { z } from 'zod'
import { resolveAuthRedirectPath } from '~/utils/auth-redirect'
const schema = z.object({ email: z.email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') })

definePageMeta({ layout: 'auth' })

const route = useRoute()
const form = reactive({
  email: '',
  password: '',
})
const errorMessage = ref('')
const isSubmitting = ref(false)

const { login } = useAuth()
const postLoginRedirect = computed(() => resolveAuthRedirectPath(route.query.redirect))

const onSubmit = async () => {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await login(form.email, form.password)
    await navigateTo(postLoginRedirect.value)
  } catch (error) {
    errorMessage.value =
      (error as Error & { message?: string }).message || 'Unable to sign in.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-8">
    <div>
      <p class="text-xs uppercase tracking-[0.08em] text-muted">Welcome back</p>
      <h1 class="mt-3 type-title">Sign in to your campaign desk</h1>
      <p class="mt-2 text-sm text-muted">
        Use your account credentials to access your campaigns.
      </p>
    </div>

    <UCard >
      <UForm :state="form" :schema="schema" class="space-y-5" @submit="onSubmit">
        <UFormField name="email" label="Email">
          <UInput v-model="form.email" type="email" autocomplete="username" placeholder="you@example.com" />
        </UFormField>
        <UFormField name="password" label="Password">
          <UInput v-model="form.password" type="password" autocomplete="current-password" placeholder="••••••••" />
        </UFormField>

        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>

        <UButton type="submit" color="primary" variant="solid" size="lg" :loading="isSubmitting" block>
          Sign in
        </UButton>

        <p class="text-sm text-muted">
          Need an account?
          <NuxtLink class="font-medium text-primary" :to="{ path: '/register', query: route.query }">
            Create one
          </NuxtLink>
        </p>
      </UForm>
    </UCard>
  </div>
</template>


