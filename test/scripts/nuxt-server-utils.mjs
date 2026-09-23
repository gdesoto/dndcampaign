import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { killProcessTree } from './test-db-utils.mjs'

const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

async function waitForHttp(baseUrl, { timeoutMs = 180_000, intervalMs = 300, readinessPath = '/login', readinessStatus = 200 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}${readinessPath}`, { signal: AbortSignal.timeout(5_000) })
      if (response.status === readinessStatus) return
      lastError = new Error(`Readiness check ${readinessPath} returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(intervalMs)
  }

  throw lastError || new Error(`Timed out waiting for server at ${baseUrl}`)
}

export async function startManagedNuxtDevServer({
  rootDir,
  env = {},
  host = '127.0.0.1',
  port = 4174,
  readinessPath = '/login',
  readinessStatus = 200,
} = {}) {
  if (!rootDir) {
    throw new Error('rootDir is required for startManagedNuxtDevServer')
  }

  const nuxtBin = resolve(rootDir, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs')
  const baseUrl = `http://${host}:${port}`

  const child = spawn(
    process.execPath,
    [nuxtBin, 'dev', '--host', host, '--port', String(port)],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
      },
    }
  )

  try {
    await waitForHttp(baseUrl, { readinessPath, readinessStatus })
  } catch (error) {
    killProcessTree(child.pid)
    throw error
  }

  const stop = async () => {
    if (child?.pid) {
      killProcessTree(child.pid)
    }
    await sleep(500)
  }

  return {
    baseUrl,
    child,
    stop,
  }
}
