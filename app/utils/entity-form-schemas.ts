import { z } from 'zod'

// Field models are shared by create/edit; server schemas still validate persistence.
export const namedEntityFormSchema = z.object({ name: z.string().trim().min(1, 'Enter a name.') }).passthrough()
export const titledEntityFormSchema = z.object({ title: z.string().trim().min(1, 'Enter a title.') }).passthrough()
export const sessionFormSchema = titledEntityFormSchema.extend({
  sessionNumber: z.string().refine(value => !value || (Number.isInteger(Number(value)) && Number(value) > 0), 'Enter a positive whole number.'),
})
