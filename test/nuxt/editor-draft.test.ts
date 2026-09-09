import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { useEditorDraft } from '../../app/composables/useEditorDraft'

describe('editor draft lifecycle', () => {
  const editor = () => {
    const state = reactive({ name: 'Original', notes: 'Old notes' })
    const draft = useEditorDraft(() => ({ ...state }), value => Object.assign(state, value))
    draft.sync({ ...state }, 'first')
    return { state, draft }
  }

  it('retains unsaved fields through repeated polling while refreshing untouched fields', () => {
    const { state, draft } = editor()
    state.name = 'My draft'
    draft.sync({ name: 'Server name', notes: 'Fresh notes' }, 'first')
    draft.sync({ name: 'Server name', notes: 'Newer notes' }, 'first')
    expect(state).toEqual({ name: 'My draft', notes: 'Newer notes' })
    expect(draft.dirty.value).toBe(true)
  })

  it('keeps changes made while a save is in flight and clears only the submitted baseline', () => {
    const { state, draft } = editor()
    state.name = 'Submitted'
    const submitted = draft.snapshot()
    state.name = 'Typed during save'
    draft.accept(submitted)
    draft.sync(submitted, 'first')
    expect(state.name).toBe('Typed during save')
    expect(draft.dirty.value).toBe(true)
    draft.accept(draft.snapshot())
    expect(draft.dirty.value).toBe(false)
  })

  it('retains a failed save draft and can discard to the latest server values', () => {
    const { state, draft } = editor()
    state.notes = 'Unsaved'
    draft.sync({ name: 'Renamed remotely', notes: 'Old notes' }, 'first')
    expect(state.notes).toBe('Unsaved')
    draft.discard()
    expect(state).toEqual({ name: 'Renamed remotely', notes: 'Old notes' })
    expect(draft.dirty.value).toBe(false)
  })

  it('never carries one record draft into a different record', () => {
    const { state, draft } = editor()
    state.notes = 'First record draft'
    draft.sync({ name: 'Second', notes: 'Second notes' }, 'second')
    expect(state).toEqual({ name: 'Second', notes: 'Second notes' })
    expect(draft.dirty.value).toBe(false)
  })
})
