import { spawn } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { killProcessTree } from './test-db-utils.mjs'

const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms))

async function waitForHttp(baseUrl, child, { timeoutMs = 180_000, intervalMs = 300, readinessPath = '/login', readinessStatus = 200 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Nuxt exited before readiness (exit ${child.exitCode}, signal ${child.signalCode})`)
    }
    try {
      const response = await fetch(`${baseUrl}${readinessPath}`, { signal: AbortSignal.timeout(5_000) })
      await response.body?.cancel()
      if (response.status === readinessStatus) return
      lastError = new Error(`Readiness check ${readinessPath} returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for ${baseUrl}${readinessPath}`, { cause: lastError })
}

export async function startManagedNuxtDevServer({
  rootDir,
  env = {},
  host = '127.0.0.1',
  port = 4174,
  readinessPath = '/login',
  readinessStatus = 200,
  logPath,
} = {}) {
  if (!rootDir) {
    throw new Error('rootDir is required for startManagedNuxtDevServer')
  }

  const nuxtBin = resolve(rootDir, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs')
  const baseUrl = `http://${host}:${port}`

  // Nuxt can choose another port if occupied; never probe an unrelated server.
  await new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(port, host, () => probe.close(resolvePort))
  })

  const logFd = logPath ? openSync(logPath, 'w') : undefined
  let child
  try {
    child = spawn(
      process.execPath,
      [nuxtBin, 'dev', '--host', host, '--port', String(port)],
      {
        cwd: rootDir,
        stdio: logFd === undefined ? 'inherit' : ['ignore', logFd, logFd],
        env: {
          ...process.env,
          ...env,
        },
      }
    )
    await new Promise((resolveSpawn, reject) => {
      child.once('spawn', resolveSpawn)
      child.once('error', reject)
    })
  } finally {
    if (logFd !== undefined) closeSync(logFd)
  }

  try {
    await waitForHttp(baseUrl, child, { readinessPath, readinessStatus })
  } catch (error) {
    killProcessTree(child.pid)
    throw new Error(`Nuxt test server failed to start${logPath ? `; see ${logPath}` : ''}`, { cause: error })
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
