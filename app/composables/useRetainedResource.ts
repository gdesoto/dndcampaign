/** Retain successful results only for the exact resource/filter scope that produced them. */
export const useRetainedResource = <T>(key: () => string) => {
  const cached = shallowRef<{ key: string; data: T }>()
  const seed = (data: T | undefined | null) => {
    if (data != null) cached.value = { key: key(), data }
  }
  const load = async (loader: () => Promise<T>) => {
    const requestKey = key()
    const data = await loader()
    if (data != null && requestKey === key()) cached.value = { key: requestKey, data }
    return data
  }
  const get = () => cached.value?.key === key() ? cached.value.data : undefined
  return { seed, load, get }
}
