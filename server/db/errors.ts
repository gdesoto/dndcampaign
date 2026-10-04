/** Drizzle wraps driver failures; only unique-key collisions are retryable here. */
export function isSqliteUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const failure = error as { code?: string; cause?: unknown }
  return failure.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || failure.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
    || (failure.cause !== error && isSqliteUniqueConstraintError(failure.cause))
}
