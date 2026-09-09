/** Imported sheets store either a numeric score or a base/total object. */
export const characterAbilityScore = (score: unknown): number | undefined => {
  const value = typeof score === 'number'
    ? score
    : score && typeof score === 'object'
      ? (score as { total?: unknown; base?: unknown }).total ?? (score as { base?: unknown }).base
      : undefined
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
