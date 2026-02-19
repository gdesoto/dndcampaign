<script setup lang="ts">
definePageMeta({ layout: 'bare' })

const form = reactive({
  email: '',
  password: '',
})
const errorMessage = ref('')
const isSubmitting = ref(false)

const { login } = useAuth()

const onSubmit = async () => {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await login(form.email, form.password)
    await navigateTo('/campaigns')
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
      <p class="text-xs uppercase tracking-[0.3em] text-muted">Welcome back</p>
      <h1 class="mt-3 text-3xl font-semibold">Sign in to your campaign desk</h1>
      <p class="mt-2 text-sm text-muted">
        Use your account credentials to access your campaigns.
      </p>
    </div>

    <UCard >
      <form class="space-y-5" @submit.prevent="onSubmit">
        <div>
          <label class="mb-2 block text-sm text-default">Email</label>
          <UInput v-model="form.email" type="email" placeholder="you@example.com" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-default">Password</label>
          <UInput v-model="form.password" type="password" placeholder="••••••••" />
        </div>

        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>

        <UButton type="submit" size="lg" :loading="isSubmitting" block>
          Sign in
        </UButton>

        <p class="text-sm text-muted">
          Need an account?
          <NuxtLink class="font-medium text-primary" to="/register">Create one</NuxtLink>
        </p>
      </form>
    </UCard>
  </div>
</template>

