import 'dotenv/config'
import path from 'node:path'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for Prisma CLI commands.')
}

const normalizeDatasourceUrl = (url) => {
  if (!url.startsWith('file:')) {
    return url
  }

  const rawPath = url.slice('file:'.length)
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(rawPath)
  const isUnixAbsolute = rawPath.startsWith('/')
  if (isWindowsAbsolute || isUnixAbsolute) {
    return `file:${rawPath.replace(/\\/g, '/')}`
  }

  // Preserve legacy Prisma schema-relative SQLite URL behavior by resolving
  // relative file paths from the `prisma/` directory.
  const resolvedPath = path.resolve(process.cwd(), 'prisma', rawPath)
  return `file:${resolvedPath.replace(/\\/g, '/')}`
}

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: normalizeDatasourceUrl(databaseUrl),
  },
}
