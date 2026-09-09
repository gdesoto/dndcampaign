import { preserveDraft } from '~/utils/preserve-draft'

/** A server baseline distinct from the editable state, including edits made during saves. */
export const useEditorDraft = <T extends Record<string, unknown>>(read: () => T, write: (value: T) => void) => {
  const snapshot = (): T => JSON.parse(JSON.stringify(read()))
  const baseline = ref<T>(snapshot())
  let identity: string | undefined
  const dirty = computed(() => JSON.stringify(read()) !== JSON.stringify(baseline.value))
  const sync = (fresh: T, key: string) => {
    const next = identity === key ? preserveDraft(snapshot(), baseline.value as T, fresh) : fresh
    identity = key
    baseline.value = JSON.parse(JSON.stringify(fresh))
    write(next)
  }
  const accept = (saved: T) => { baseline.value = JSON.parse(JSON.stringify(saved)) }
  const discard = () => write(JSON.parse(JSON.stringify(baseline.value)))
  return { dirty, snapshot, sync, accept, discard }
}
