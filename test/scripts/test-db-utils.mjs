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
  sessionPassword = 'test-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
} = {}) {
  if (!rootDir) {
    throw new Error('rootDir is required for createTestDbContext')
  }

  const dbDir = resolve(rootDir, 'storage', 'db')
  const dbFile = `${prefix}-${process.pid}-${Date.now()}.db`
  const dbPath = resolve(dbDir, dbFile)
  const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`

  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    NUXT_SESSION_PASSWORD: sessionPassword,
  }

  const prepare = ({ migrate = true, seed = false, stdio = 'pipe' } = {}) => {
    mkdirSync(dbDir, { recursive: true })
    writeFileSync(dbPath, '')

    if (migrate) {
      execSync('npx prisma migrate deploy', {
        cwd: rootDir,
        env,
        stdio,
        shell: true,
      })
    }

    if (seed) {
      execSync('node prisma/seed.mjs', {
        cwd: rootDir,
        env,
        stdio,
        shell: true,
      })
    }
  }

  const cleanup = async ({ retries = 20, delayMs = 200 } = {}) => {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        rmSync(dbPath, { force: true })
        return
      } catch {
        await sleep(delayMs)
      }
    }
  }

  return {
    dbDir,
    dbFile,
    dbPath,
    dbUrl,
    env,
    prepare,
    cleanup,
  }
}
