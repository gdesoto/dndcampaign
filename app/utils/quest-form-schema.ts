import { z } from 'zod'
import { questCreateSchema } from '#shared/schemas/quest'

// Validate the editor's flat fields with the same rules as quest creation.
export const questFormSchema = z.object({}).passthrough().superRefine((form, ctx) => {
  const result = questCreateSchema.safeParse({
    ...form,
    sourceText: form.sourceType === 'FREE_TEXT' ? form.sourceText || undefined : undefined,
    sourceNpcId: form.sourceType === 'NPC' ? form.sourceNpcId || undefined : undefined,
    sourceCharacterId: form.sourceType === 'CAMPAIGN_CHARACTER' ? form.sourceCharacterId || undefined : undefined,
    expirationDate: form.expirationEnabled
      ? { year: form.expirationYear, month: form.expirationMonth, day: form.expirationDay }
      : undefined,
  })
  if (result.success) return

  for (const issue of result.error.issues) {
    const dateFields: Record<string, string> = {
      year: 'expirationYear', month: 'expirationMonth', day: 'expirationDay',
    }
    const path = issue.path[0] === 'expirationDate'
      ? [dateFields[String(issue.path[1])] || 'expirationYear']
      : issue.path
    ctx.addIssue({ code: 'custom', path, message: issue.message })
  }
})
