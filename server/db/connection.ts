import Sqlite from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { resolveDatabasePath } from './sqlite-path.mjs'

export function createDatabase(url: string, options: Sqlite.Options = {}) {
  const sqlite = new Sqlite(resolveDatabasePath(url), { timeout: 5000, ...options })
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

export type Database = ReturnType<typeof createDatabase>
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
