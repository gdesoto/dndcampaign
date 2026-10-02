import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startManagedNuxtDevServer } from './nuxt-server-utils.mjs'
import { createTestDbContext } from './test-db-utils.mjs'

export default async function apiGlobalSetup() {
  const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const db = createTestDbContext({
    rootDir,
    prefix: 'api-global',
    sessionPassword: 'api-global-session-password-1234567890-abcdefghijklmnopqrstuvwxyz',
  })

  let server
  try {
    db.prepare({ migrate: true, seed: false, stdio: 'pipe' })
    server = await startManagedNuxtDevServer({
      rootDir,
      port: 4181,
      // Retired API routes reach Nuxt's page fallback. Wait for the rendered
      // login page so the renderer's cold compilation finishes during setup.
      logPath: resolve(rootDir, 'storage', 'api-test-server.log'),
      env: {
        ...db.env,
        VITE_HMR_PORT: '24685',
        VITE_HMR_HOST: '127.0.0.1',
      },
    })
  } catch (error) {
    await db.cleanup()
    throw error
  }

  process.env.API_TEST_BASE_URL = server.baseUrl
  process.env.API_TEST_DATABASE_URL = db.dbUrl

  return async () => {
    try {
      await server.stop()
    } finally {
      await db.cleanup()
    }
  }
}
