/** Merge fresh server fields while retaining fields changed since the last baseline. */
export const preserveDraft = <T extends Record<string, unknown>>(draft: T, baseline: T, fresh: T): T => {
  const result = { ...fresh }
  for (const key of Object.keys(draft) as Array<keyof T>) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(baseline[key])) result[key] = draft[key]
  }
  return result
}
