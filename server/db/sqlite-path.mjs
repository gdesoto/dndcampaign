import path from 'node:path'

/** Preserve the existing schema-relative file: URLs used by local installations. */
export function resolveDatabasePath(url, root = process.cwd()) {
  if (!url) throw new Error('DATABASE_URL is required.')
  if (!url.startsWith('file:')) return url
  const filename = url.slice(5)
  if (!filename) throw new Error('DATABASE_URL must identify a SQLite file.')
  if (/^[A-Za-z]:[\\/]/.test(filename) || filename.startsWith('/')) return filename
  return path.resolve(root, 'prisma', filename)
}
