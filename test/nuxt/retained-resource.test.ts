import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useRetainedResource } from '../../app/composables/useRetainedResource'

describe('retained resource recovery', () => {
  it('retains successful data after failure without showing it under different filters', async () => {
    const key = ref('campaign-a:all')
    const cache = useRetainedResource<string[]>(() => key.value)
    cache.seed(['Hydrated record'])
    await expect(cache.load(async () => { throw new Error('Offline') })).rejects.toThrow('Offline')
    expect(cache.get()).toEqual(['Hydrated record'])
    key.value = 'campaign-a:missing'
    expect(cache.get()).toBeUndefined()
    await cache.load(async () => [])
    expect(cache.get()).toEqual([])
  })

  it('does not let an old request replace the current scope cache', async () => {
    const key = ref('first')
    const cache = useRetainedResource<string[]>(() => key.value)
    let resolveOld!: (value: string[]) => void
    const old = cache.load(() => new Promise(resolve => { resolveOld = resolve }))
    key.value = 'second'
    await cache.load(async () => ['Current record'])
    resolveOld(['Old record'])
    await old
    expect(cache.get()).toEqual(['Current record'])
  })
})
