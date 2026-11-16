import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

export function killProcessTree(pid) {
  if (!pid) return

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
      return
    }
    process.kill(pid, 'SIGTERM')
  } catch {
    // Best-effort teardown for test infrastructure.
  }
}

export function createTestDbContext({
  rootDir,
  prefix = 'test',
  appSecret = 'test-app-secret-1234567890-abcdefghijklmnopqrstuvwxyz',
} = {}) {
  if (!rootDir) {
    throw new Error('rootDir is required for createTestDbContext')
  }

  const dbDir = resolve(rootDir, 'storage', 'db')
  const dbFile = `${prefix}-${process.pid}-${Date.now()}.db`
  const dbPath = resolve(dbDir, dbFile)
  const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`
  const tmpDir = resolve(rootDir, 'tmp')
  const storageRoot = resolve(tmpDir, `test-storage-${process.pid}-${process.hrtime.bigint()}`)

  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    NUXT_APP_SECRET: appSecret,
    NUXT_STORAGE_LOCAL_ROOT: storageRoot,
  }

  const prepare = ({ migrate = true, seed = false, stdio = 'pipe' } = {}) => {
    mkdirSync(dbDir, { recursive: true })
    mkdirSync(storageRoot, { recursive: true })
    writeFileSync(dbPath, '')

    if (migrate) {
      execSync('node scripts/database.mjs migrate', {
        cwd: rootDir,
        env,
        stdio,
        shell: true,
      })
    }

    if (seed) {
      execSync('node --import tsx scripts/seed.ts', {
        cwd: rootDir,
        env,
        stdio,
        shell: true,
      })
    }
  }

  const cleanup = async ({ retries = 20, delayMs = 200 } = {}) => {
    if (resolve(storageRoot, '..') !== tmpDir) throw new Error('Test storage cleanup must stay inside the temporary directory.')
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        for (const suffix of ['', '-journal', '-wal', '-shm']) {
          rmSync(`${dbPath}${suffix}`, { force: true })
        }
        rmSync(storageRoot, { recursive: true, force: true })
        return
      } catch (error) {
        if (attempt === retries - 1) throw error
        await sleep(delayMs)
      }
    }
  }

  return {
    dbDir,
    dbFile,
    dbPath,
    dbUrl,
    storageRoot,
    env,
    prepare,
    cleanup,
  }
}
