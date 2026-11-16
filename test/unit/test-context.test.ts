import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { createTestDbContext } from '../scripts/test-db-utils.mjs'

it('isolates each test context and removes only its own database and artifacts', async () => {
  const temporaryParent = resolve(tmpdir())
  const rootDir = mkdtempSync(join(temporaryParent, 'dm-vault-test-context-'))
  if (dirname(resolve(rootDir)) !== temporaryParent || !basename(rootDir).startsWith('dm-vault-test-context-')) {
    throw new Error('Test cleanup must stay inside its owned temporary root.')
  }
  try {
    const appSecret = 'context-specific-secret-1234567890-abcdefghijklmnopqrstuvwxyz'
    const first = createTestDbContext({ rootDir, prefix: 'first', appSecret })
    const second = createTestDbContext({ rootDir, prefix: 'second' })
    first.prepare({ migrate: false })
    second.prepare({ migrate: false })

    expect(isAbsolute(first.storageRoot)).toBe(true)
    expect(dirname(first.storageRoot)).toBe(join(rootDir, 'tmp'))
    expect(first.storageRoot).not.toBe(second.storageRoot)
    expect(first.dbPath).not.toBe(second.dbPath)
    expect(first.env.NUXT_STORAGE_LOCAL_ROOT).toBe(first.storageRoot)
    expect(second.env.NUXT_STORAGE_LOCAL_ROOT).toBe(second.storageRoot)
    expect(first.env.DATABASE_URL).toBe(first.dbUrl)
    expect(first.env.NUXT_APP_SECRET).toBe(appSecret)

    const artifactDirectory = join(first.storageRoot, 'recordings')
    mkdirSync(artifactDirectory)
    writeFileSync(join(artifactDirectory, 'first.txt'), 'first artifact')
    const secondArtifact = join(second.storageRoot, 'second.txt')
    writeFileSync(secondArtifact, 'second artifact')
    const sentinel = join(rootDir, 'tmp', 'unrelated.txt')
    writeFileSync(sentinel, 'keep this file')
    const databaseFiles = ['', '-journal', '-wal', '-shm'].map(suffix => `${first.dbPath}${suffix}`)
    for (const filename of databaseFiles.slice(1)) writeFileSync(filename, 'temporary sidecar')
    expect(databaseFiles.every(filename => existsSync(filename))).toBe(true)

    await first.cleanup()
    expect(databaseFiles.every(filename => !existsSync(filename))).toBe(true)
    expect(existsSync(first.storageRoot)).toBe(false)
    expect(existsSync(second.dbPath)).toBe(true)
    expect(readFileSync(secondArtifact, 'utf8')).toBe('second artifact')
    expect(readFileSync(sentinel, 'utf8')).toBe('keep this file')

    await second.cleanup()
    expect(existsSync(second.dbPath)).toBe(false)
    expect(existsSync(second.storageRoot)).toBe(false)
    expect(readFileSync(sentinel, 'utf8')).toBe('keep this file')
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})
