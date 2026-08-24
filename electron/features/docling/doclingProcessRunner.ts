import { spawn } from 'node:child_process'

/**
 * Hardened child-process runner for the private Docling runtime.
 *
 * SECURITY rules enforced here:
 * - `shell` is never used; the executable is always an absolute path and the
 *   arguments are passed as an argv array.
 * - The inherited environment is scrubbed of PYTHONHOME/PYTHONPATH so a host
 *   Python configuration can never leak into (or poison) the private runtime.
 * - Every call has a hard timeout; the child receives SIGTERM then SIGKILL.
 */

export interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

export class CommandError extends Error {
  readonly code: 'timeout' | 'non_zero_exit'
  readonly result: CommandResult | null

  constructor(code: 'timeout' | 'non_zero_exit', message: string, result: CommandResult | null) {
    super(message)
    this.name = 'CommandError'
    this.code = code
    this.result = result
  }
}

/** Merge the parent environment with runtime overrides, minus python leaks. */
export function buildRuntimeEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  // SECURITY: host interpreter configuration must not reach the private one.
  delete env.PYTHONHOME
  delete env.PYTHONPATH
  return Object.assign(env, overrides)
}

export interface RunCommandOptions {
  envOverrides?: Record<string, string>
  timeoutMs?: number
  /** Bytes of stdout/stderr kept in memory; older output is dropped. */
  maxBufferChars?: number
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_MAX_BUFFER_CHARS = 200_000

// Concurrency limiter: at most 2 simultaneous Docling/uv processes to
// bound CPU/RAM when user opens many tabs quickly.
const MAX_CONCURRENT = 2
let activeCount = 0
const waitQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount += 1
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => waitQueue.push(resolve))
}

function releaseSlot(): void {
  activeCount = Math.max(0, activeCount - 1)
  const next = waitQueue.shift()
  if (next) {
    activeCount += 1
    next()
  }
}

/** Kill a process and its entire child tree (Windows taskkill / Unix kill -pid). */
export async function killProcessTree(pid: number): Promise<void> {
  try {
    if (process.platform === 'win32') {
      const { spawn } = await import('node:child_process')
      await new Promise<void>((resolve) => {
        const c = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
        c.on('close', () => resolve())
        c.on('error', () => resolve())
        setTimeout(() => resolve(), 3000)
      })
    } else {
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        try {
          process.kill(pid, 'SIGTERM')
        } catch {}
      }
      await new Promise<void>((r) => setTimeout(r, 800))
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {}
      }
    }
  } catch {}
}

function tail(value: string, maxChars: number): string {
  return value.length > maxChars ? value.slice(value.length - maxChars) : value
}

export async function runCommand(
  exe: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const {
    envOverrides = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBufferChars = DEFAULT_MAX_BUFFER_CHARS
  } = options

  await acquireSlot()
  let slotReleased = false
  const releaseOnce = (): void => {
    if (!slotReleased) {
      slotReleased = true
      releaseSlot()
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      shell: false,
      windowsHide: true,
      env: buildRuntimeEnv(envOverrides)
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      settled = true
      clearTimeout(timer)
      // Use tree kill for timeout to avoid orphaned grandchildren (e.g. pip inside uv)
      void killProcessTree(child.pid ?? 0).catch(() => child.kill('SIGKILL'))
      releaseOnce()
      reject(new CommandError('timeout', `Command timed out after ${timeoutMs}ms`, null))
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < maxBufferChars) stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < maxBufferChars) stderr += chunk.toString('utf8')
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      releaseOnce()
      reject(err)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      releaseOnce()
      resolve({
        code: code ?? -1,
        stdout: tail(stdout, maxBufferChars),
        stderr: tail(stderr, maxBufferChars)
      })
    })
  })
}

/** runCommand variant that treats non-zero exits as thrown errors. */
export async function runCommandChecked(
  exe: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const result = await runCommand(exe, args, options)
  if (result.code !== 0) {
    throw new CommandError(
      'non_zero_exit',
      `Command failed (${result.code}): ${exe} ${args.join(' ')}` +
        (result.stderr ? `\n${tail(result.stderr, 4000)}` : '') +
        (result.stdout ? `\n[stdout tail] ${tail(result.stdout, 1000)}` : ''),
      result
    )
  }
  return result
}
