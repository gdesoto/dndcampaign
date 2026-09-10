import { inject, type InjectionKey } from 'vue'
import type { useSessionWorkspaceViewModel } from './useSessionWorkspaceViewModel'

export const sessionWorkspaceKey: InjectionKey<ReturnType<typeof useSessionWorkspaceViewModel>> = Symbol('session-workspace')

/** Children consume their parent's workspace; they must never create another. */
export function useSessionWorkspaceContext() {
  const workspace = inject(sessionWorkspaceKey)
  if (!workspace) throw new Error('Session workspace requires a session parent route.')
  return workspace
}
