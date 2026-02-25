import { PrismaClient } from '#server/db/prisma-client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'node:path'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize Prisma client.')
}

const toSqlitePath = (url: string): string => {
  if (!url.startsWith('file:')) {
    return url
  }

  const rawPath = url.slice('file:'.length)
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(rawPath)
  const isUnixAbsolute = rawPath.startsWith('/')
  if (isWindowsAbsolute || isUnixAbsolute) {
    return rawPath
  }

  // Keep runtime SQLite URL semantics aligned with legacy schema-relative URLs.
  return path.resolve(process.cwd(), 'prisma', rawPath)
}

const adapter = new PrismaBetterSqlite3(
  { url: toSqlitePath(databaseUrl) },
  { timestampFormat: 'unixepoch-ms' }
)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

