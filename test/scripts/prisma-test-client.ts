import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { getApiTestDatabaseUrl } from './api-test-context.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..', '..')

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

  return path.resolve(projectRoot, 'prisma', rawPath)
}

export const createApiTestPrismaClient = () => {
  const adapter = new PrismaBetterSqlite3(
    { url: toSqlitePath(getApiTestDatabaseUrl()) },
    { timestampFormat: 'unixepoch-ms' }
  )

  return new PrismaClient({ adapter })
}
