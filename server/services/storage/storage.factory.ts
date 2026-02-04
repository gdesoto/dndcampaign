import { useRuntimeConfig } from '#imports'
import type { StorageAdapter } from './storage.types'
import { LocalStorageAdapter } from './local.adapter'

export const getStorageAdapter = (): StorageAdapter => {
  const config = useRuntimeConfig()
  const provider = (config.storage?.provider || 'local').toLowerCase()

  if (provider === 'local') {
    const root = config.storage?.localRoot || './storage'
    return new LocalStorageAdapter(root)
  }

  throw new Error(`Storage provider not implemented: ${provider}`)
}
