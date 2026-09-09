import { describe, expect, it } from 'vitest'
import { preserveDraft } from '../../app/utils/preserve-draft'

describe('preserveDraft', () => {
  it('retains an unsaved section when another section is saved', () => {
    const baseline = { biography: 'Old story', abilities: { str: 10 } }
    const draft = { biography: 'Unsaved story', abilities: { str: 12 } }
    const fresh = { biography: 'Old story', abilities: { str: 12 } }
    expect(preserveDraft(draft, baseline, fresh)).toEqual({ biography: 'Unsaved story', abilities: { str: 12 } })
  })
  it('takes server updates only for unchanged fields and leaves inputs untouched', () => {
    const baseline = { name: 'Old name', hp: 8 }
    const draft = { name: 'Edited name', hp: 8 }
    expect(preserveDraft(draft, baseline, { name: 'Old name', hp: 5 })).toEqual({ name: 'Edited name', hp: 5 })
    expect(draft).toEqual({ name: 'Edited name', hp: 8 })
  })
})
