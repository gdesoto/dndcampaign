import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'
import path from 'node:path'

const normalizeDatasourceUrl = (url: string) => {
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

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx ./prisma/seed.ts',
  },
  datasource: {
    url: normalizeDatasourceUrl(env('DATABASE_URL')),
  },
})
