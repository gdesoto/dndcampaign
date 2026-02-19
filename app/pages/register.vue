<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'bare' })

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(10, 'Password must be at least 10 characters long'),
    termsAccepted: z.boolean().refine((value) => value === true, {
      message: 'You must accept the terms to continue',
    }),
  })

type RegisterSchema = z.output<typeof schema>

const state = reactive<Partial<RegisterSchema>>({
  name: '',
  email: '',
  password: '',
  termsAccepted: false,
})

const { register } = useAuth()
const isSubmitting = ref(false)
const errorMessage = ref('')

const onSubmit = async (event: FormSubmitEvent<RegisterSchema>) => {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await register(event.data)
    await navigateTo('/campaigns')
  } catch (error) {
    errorMessage.value = (error as Error & { message?: string }).message || 'Unable to register.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-8">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-muted">Get started</p>
      <h1 class="mt-3 text-3xl font-semibold">Create your campaign account</h1>
      <p class="mt-2 text-sm text-muted">Register to manage campaigns, sessions, and world notes.</p>
    </div>

    <UCard>
      <UForm :state="state" :schema="schema" class="space-y-5" @submit="onSubmit">
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" placeholder="Dungeon Master" />
        </UFormField>

        <UFormField label="Email" name="email">
          <UInput v-model="state.email" type="email" placeholder="you@example.com" />
        </UFormField>

        <UFormField label="Password" name="password" description="Use at least 10 characters.">
          <UInput v-model="state.password" type="password" placeholder="••••••••••" />
        </UFormField>

        <UFormField name="termsAccepted">
          <UCheckbox v-model="state.termsAccepted" label="I accept the terms and privacy policy" />
        </UFormField>

        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>

        <div class="space-y-3">
          <UButton type="submit" size="lg" :loading="isSubmitting" block>
            Create account
          </UButton>

          <p class="text-sm text-muted">
            Already have an account?
            <NuxtLink class="font-medium text-primary" to="/login">Sign in</NuxtLink>
          </p>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
