import { describe, expect, it } from 'vitest'
import { questFormSchema } from '../../app/utils/quest-form-schema'

const draft = {
  title: 'Recover the seal', type: 'CAMPAIGN', track: 'SIDE',
  sourceType: 'FREE_TEXT', sourceText: '', sourceNpcId: '', sourceCharacterId: '',
  expirationEnabled: false, expirationYear: 1, expirationMonth: 1, expirationDay: 1,
}

describe('quest modal validation', () => {
  it.each(['', '   '])('reports a missing source beside the source field (%j)', (sourceText) => {
    const result = questFormSchema.safeParse({ ...draft, sourceText })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['sourceText'] }))
  })

  it('accepts free text with empty inactive source selectors', () => {
    expect(questFormSchema.safeParse({ ...draft, sourceText: 'The town noticeboard' }).success).toBe(true)
  })

  it.each([
    ['CAMPAIGN', 'NPC', 'sourceNpcId'],
    ['CHARACTER', 'CAMPAIGN_CHARACTER', 'sourceCharacterId'],
  ])('requires the selected %s source', (type, sourceType, field) => {
    const form = { ...draft, type, sourceType }
    const result = questFormSchema.safeParse(form)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field] }))
    expect(questFormSchema.safeParse({ ...form, [field]: '123e4567-e89b-42d3-a456-426614174000' }).success).toBe(true)
  })

  it('enforces API title lengths and maps date errors to the editor fields', () => {
    const result = questFormSchema.safeParse({ ...draft, title: 'A', sourceText: 'Noticeboard', expirationEnabled: true, expirationDay: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path)).toEqual(expect.arrayContaining([['title'], ['expirationDay']]))
    }
    expect(questFormSchema.safeParse({ ...draft, title: 'A'.repeat(201), sourceText: 'Noticeboard' }).success).toBe(false)
  })
})
