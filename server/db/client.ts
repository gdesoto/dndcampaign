import { createDatabase, type Database } from './connection'

const globalDatabase = globalThis as typeof globalThis & { dmVaultDatabase?: Database }
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to initialize the database.')

export const db = globalDatabase.dmVaultDatabase?.$client.open ? globalDatabase.dmVaultDatabase : createDatabase(databaseUrl)
if (process.env.NODE_ENV !== 'production') globalDatabase.dmVaultDatabase = db

export type { Database, DbTransaction } from './connection'
