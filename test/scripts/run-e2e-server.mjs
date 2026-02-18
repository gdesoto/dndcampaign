import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTestDbContext, killProcessTree } from './test-db-utils.mjs'

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const db = createTestDbContext({
  rootDir,
  prefix: 'e2e',
  sessionPassword: 'e2e-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
})

db.prepare({ migrate: true, seed: true, stdio: 'inherit' })

const nuxtBin = resolve(rootDir, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs')

const child = spawn(
  process.execPath,
  [nuxtBin, 'dev', '--host', '127.0.0.1', '--port', '4173'],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...db.env,
      VITE_HMR_PORT: '24679',
      VITE_HMR_HOST: '127.0.0.1',
    },
  }
)

let shuttingDown = false

const shutdown = async (signal) => {
  if (shuttingDown) return
  shuttingDown = true

  if (child?.pid) {
    killProcessTree(child.pid)
  }
  await db.cleanup()
}

process.on('SIGINT', async () => {
  await shutdown('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await shutdown('SIGTERM')
  process.exit(0)
})

child.on('exit', async (code) => {
  await db.cleanup()
  process.exit(code ?? 0)
})
