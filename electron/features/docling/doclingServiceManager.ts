import { type ChildProcess, spawn } from 'node:child_process'
import { type Dirent, promises as fs } from 'node:fs'
import path from 'node:path'

import type { DoclingServiceState, DoclingServiceStatus } from '../../../shared/types/index.js'
import { Logger } from '../../core/logger.js'
import { readDoclingManifest } from './doclingManifest.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import {
  ensureSidecarScript,
  generateToken as defaultGenerateToken,
  getFreePort as defaultGetFreePort,
  httpHealthCheck as defaultHttpHealthCheck,
  waitForHealthy
} from './doclingServiceUtils.js'

const STARTUP_TIMEOUT_MS = 15_000
const HEALTH_INTERVAL_MS = 300
const GRACEFUL_SHUTDOWN_MS = 5000
const MAX_PORT_RETRIES = 3

export interface DoclingServiceManagerDeps {
  spawnFn: typeof spawn
  getFreePortFn: () => Promise<number>
  generateTokenFn: () => string
  httpHealthCheckFn: (port: number, token: string) => Promise<boolean>
  getLayoutFn: typeof getDoclingLayout
  readManifestFn: typeof readDoclingManifest
  startupTimeoutMs: number
  healthIntervalMs: number
  gracefulShutdownMs: number
}

export class DoclingServiceManager {
  private child: ChildProcess | null = null
  private port: number | null = null
  private token: string | null = null
  private state: DoclingServiceState = 'stopped'
  private lastError: string | null = null
  private startTime: number | null = null
  private startPromise: Promise<void> | null = null
  private stopPromise: Promise<void> | null = null
  private deps: DoclingServiceManagerDeps

  private statusListeners = new Set<(status: DoclingServiceStatus) => void>()

  constructor(deps: Partial<DoclingServiceManagerDeps> = {}) {
    this.deps = {
      spawnFn: spawn,
      getFreePortFn: defaultGetFreePort,
      generateTokenFn: defaultGenerateToken,
      httpHealthCheckFn: defaultHttpHealthCheck,
      getLayoutFn: getDoclingLayout,
      readManifestFn: readDoclingManifest,
      startupTimeoutMs: STARTUP_TIMEOUT_MS,
      healthIntervalMs: HEALTH_INTERVAL_MS,
      gracefulShutdownMs: GRACEFUL_SHUTDOWN_MS,
      ...deps
    }
  }

  onStatusChanged(listener: (status: DoclingServiceStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private emitStatus(): void {
    const status = this.buildStatusSync()
    for (const listener of this.statusListeners) {
      try {
        listener(status)
      } catch {
        // ignore listener errors
      }
    }
  }

  private setState(next: DoclingServiceState, error: string | null = null): void {
    this.state = next
    if (error !== null) this.lastError = error
    else if (next === 'running' || next === 'stopped') this.lastError = null
    this.emitStatus()
  }

  private buildStatusSync(): DoclingServiceStatus {
    const uptimeMs = this.startTime && this.state === 'running' ? Date.now() - this.startTime : null
    return {
      state: this.state,
      installed: false, // filled async in getStatus()
      port: this.port,
      pid: this.child?.pid ?? null,
      uptimeMs,
      lastError: this.lastError,
      healthy: this.state === 'running',
      diskUsageBytes: null,
      modelStatus: 'unknown'
    }
  }

  private async getDirectorySize(dir: string): Promise<number> {
    try {
      let total = 0
      const stack: string[] = [dir]
      while (stack.length > 0) {
        const current = stack.pop()!
        const entries = await fs
          .readdir(current, { withFileTypes: true })
          .catch(() => [] as Dirent[])
        for (const entry of entries) {
          const full = path.join(current, entry.name)
          if (entry.isDirectory()) stack.push(full)
          else if (entry.isFile()) {
            try {
              const stat = await fs.stat(full)
              total += stat.size
            } catch {}
          }
        }
      }
      return total
    } catch {
      return 0
    }
  }

  private async getDiskUsageBytes(): Promise<number | null> {
    try {
      const layout = this.deps.getLayoutFn()
      // Engine = runtime + environment + bin (+ service script). Deliberately
      // excludes:
      // - models/ (shown separately in Modeller kartı)
      // - temp/ (uv-cache + conversions staging, GB’larca olabilir)
      // - documents/ (dönüşüm görüntüleri, birikirse şişer)
      // Walking the whole root previously double-counted and produced
      // ~8–9 GB gibi anlamsız değerler.
      const candidates = [
        layout.runtime,
        layout.environment,
        layout.bin,
        path.join(layout.root, 'service')
      ]
      let total = 0
      for (const dir of candidates) {
        total += await this.getDirectorySize(dir)
      }
      // component.json gibi kökteki küçük dosyaları da ekle
      try {
        const stat = await fs.stat(layout.manifestFile)
        if (stat.isFile()) total += stat.size
      } catch {}
      return total
    } catch {
      return null
    }
  }

  private async getModelStatus(): Promise<DoclingServiceStatus['modelStatus']> {
    try {
      const layout = this.deps.getLayoutFn()
      const entries = await fs.readdir(layout.models).catch(() => [] as string[])
      // fs.readdir with string[] fallback needs handling
      const list = Array.isArray(entries) ? entries : []
      if (list.length === 0) return 'missing'
      return 'ready'
    } catch {
      return 'unknown'
    }
  }

  async isInstalled(): Promise<boolean> {
    try {
      const layout = this.deps.getLayoutFn()
      const manifest = await this.deps.readManifestFn(layout)
      if (manifest.status !== 'ready') return false
      const venvPython = getVenvPythonPath(layout)
      await fs.access(venvPython)
      return true
    } catch {
      return false
    }
  }

  async getStatus(): Promise<DoclingServiceStatus> {
    const installed = await this.isInstalled()
    const base = this.buildStatusSync()
    // Disk kullanımı her zaman gösterilsin – isInstalled=false iken bile
    // artıklar (örn. yarım kalan kurulum) diskte kalabilir, kullanıcı
    // görmezse temizleyemez. “Bazen görülmüyor” şikâyeti buydu.
    const [diskUsageBytes, modelStatus] = await Promise.all([
      this.getDiskUsageBytes(),
      this.getModelStatus()
    ])
    if (!installed) return { ...base, installed, diskUsageBytes, modelStatus: 'unknown' }
    return { ...base, installed, diskUsageBytes, modelStatus }
  }

  async healthCheck(): Promise<boolean> {
    if (this.state !== 'running' || this.port === null || this.token === null) return false
    try {
      return await this.deps.httpHealthCheckFn(this.port, this.token)
    } catch {
      return false
    }
  }

  async ensureRunning(): Promise<DoclingServiceStatus> {
    const status = await this.getStatus()
    if (status.state === 'running') {
      const healthy = await this.healthCheck()
      if (healthy) return this.getStatus()
      // Unhealthy but running -> restart
      await this.restart()
      return this.getStatus()
    }
    if (status.state === 'starting') {
      if (this.startPromise) await this.startPromise
      return this.getStatus()
    }
    await this.start()
    return this.getStatus()
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise
    if (this.state === 'running') return

    this.startPromise = (async () => {
      const installed = await this.isInstalled()
      if (!installed) {
        const msg = 'Docling is not installed'
        this.setState('error', msg)
        throw new Error(msg)
      }
      await this.doStart()
    })().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async doStart(): Promise<void> {
    this.setState('starting')
    this.lastError = null
    let lastErr: unknown = null

    for (let attempt = 0; attempt < MAX_PORT_RETRIES; attempt += 1) {
      let port: number
      try {
        port = await this.deps.getFreePortFn()
      } catch (error) {
        lastErr = error
        continue
      }

      const token = this.deps.generateTokenFn()
      try {
        await this.spawnAndWaitHealthy(port, token)
        this.port = port
        this.token = token
        this.startTime = Date.now()
        this.setState('running')
        Logger.info('[DoclingService] Service started', { port, pid: this.child?.pid })
        return
      } catch (error) {
        lastErr = error
        const msg = error instanceof Error ? error.message : String(error)
        // Do not log token
        Logger.warn('[DoclingService] Start attempt failed', {
          attempt: attempt + 1,
          port,
          error: msg
        })
        await this.killChild()
        // If port collision, try next port; otherwise break and report
        const isPortError =
          msg.includes('EADDRINUSE') ||
          msg.includes('address already in use') ||
          msg.includes('port')
        if (!isPortError && attempt === 0) {
          // For non-port errors, don't retry with new port unnecessarily, but still allow retries up to MAX
          // Actually we should retry only on port errors; for other errors, fail fast
          // To keep behavior simple, break after first non-port error
          break
        }
      }
    }

    const message =
      lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'Unknown start error')
    this.setState('error', message)
    throw new Error(message)
  }

  private async spawnAndWaitHealthy(port: number, token: string): Promise<void> {
    const layout = this.deps.getLayoutFn()
    const venvPython = getVenvPythonPath(layout)

    const sidecarPath = await ensureSidecarScript(layout.root)

    const args = [sidecarPath, '--host', '127.0.0.1', '--port', String(port)]
    const env = {
      DOCLING_SIDECAR_TOKEN: token,
      DOCLING_ARTIFACTS_PATH: layout.models,
      PYTHONUNBUFFERED: '1'
    }

    let child: ChildProcess
    try {
      child = this.deps.spawnFn(venvPython, args, {
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          ...env,
          PYTHONHOME: undefined,
          PYTHONPATH: undefined
        } as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      throw new Error(
        `Failed to spawn Docling service: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    this.child = child

    // Attach crash handler
    const exitPromise = new Promise<never>((_, reject) => {
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        const msg = `Docling service exited unexpectedly (code=${code} signal=${signal})`
        // Only treat as error if we were in starting/running
        if (this.state === 'starting' || this.state === 'running') {
          this.setState('error', msg)
        }
        reject(new Error(msg))
      }
      const onError = (err: Error) => {
        const msg = `Docling service spawn error: ${err.message}`
        if (this.state === 'starting' || this.state === 'running') {
          this.setState('error', msg)
        }
        reject(new Error(msg))
      }
      child.once('exit', onExit)
      child.once('error', onError)
    })

    // Capture stdout/stderr for diagnostics (redact token if it ever appears)
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').replaceAll(token, '[redacted]')
      Logger.info(`[DoclingService:stdout] ${text.trim()}`)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').replaceAll(token, '[redacted]')
      Logger.warn(`[DoclingService:stderr] ${text.trim()}`)
    })

    // Remove our temporary exit handlers after successful startup
    const cleanupExitHandlers = () => {
      child.removeAllListeners('exit')
      child.removeAllListeners('error')
      // Re-attach persistent crash handler
      child.once('exit', (code, signal) => {
        Logger.warn('[DoclingService] Process exited', { code, signal })
        if (this.state === 'running' || this.state === 'starting') {
          this.child = null
          this.port = null
          this.token = null
          this.startTime = null
          this.setState(
            this.state === 'starting' ? 'error' : 'stopped',
            `Exited code=${code} signal=${signal}`
          )
        }
      })
      child.once('error', (err) => {
        Logger.error('[DoclingService] Process error', err)
        this.child = null
        this.port = null
        this.token = null
        this.startTime = null
        this.setState('error', err.message)
      })
    }

    const deadline = Date.now() + this.deps.startupTimeoutMs

    try {
      await Promise.race([
        waitForHealthy(
          port,
          token,
          deadline,
          this.deps.httpHealthCheckFn,
          this.deps.healthIntervalMs,
          () => this.child === null
        ),
        exitPromise
      ])
      cleanupExitHandlers()
    } catch (error) {
      cleanupExitHandlers()
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise
    if (this.state === 'stopped' || this.child === null) {
      this.port = null
      this.token = null
      this.startTime = null
      this.setState('stopped')
      return
    }
    this.stopPromise = this.doStop().finally(() => {
      this.stopPromise = null
    })
    return this.stopPromise
  }

  private async doStop(): Promise<void> {
    const child = this.child
    if (!child) {
      this.setState('stopped')
      return
    }
    this.setState('stopping')
    Logger.info('[DoclingService] Stopping service', { pid: child.pid })

    const killed = await new Promise<boolean>((resolve) => {
      if (!child.pid) {
        resolve(false)
        return
      }
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        try {
          child.kill('SIGKILL')
        } catch {}
        // Give a moment for SIGKILL to take effect
        setTimeout(() => resolve(false), 500)
      }, this.deps.gracefulShutdownMs)

      child.once('exit', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(true)
      })
      try {
        child.kill('SIGTERM')
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })

    this.child = null
    this.port = null
    this.token = null
    this.startTime = null
    this.setState('stopped')
    Logger.info('[DoclingService] Service stopped', { graceful: killed })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  private async killChild(): Promise<void> {
    const child = this.child
    if (!child) return
    this.child = null
    this.port = null
    this.token = null
    this.startTime = null
    try {
      child.kill('SIGKILL')
    } catch {}
    // Remove listeners to avoid zombie handlers
    child.removeAllListeners()
    // Wait a tick for OS to reap
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  /** Called on app quit to ensure no zombie remains */
  async dispose(): Promise<void> {
    if (this.state === 'stopped' && this.child === null) return
    try {
      await this.stop()
    } catch {
      await this.killChild()
    }
  }

  /** Test helper: reset internal state */
  _resetForTests(): void {
    this.child = null
    this.port = null
    this.token = null
    this.state = 'stopped'
    this.lastError = null
    this.startTime = null
    this.startPromise = null
    this.stopPromise = null
    this.statusListeners.clear()
  }
}

export const doclingServiceManager = new DoclingServiceManager()
