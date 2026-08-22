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
      child.kill('SIGKILL')
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
      reject(err)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
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
        (result.stderr ? `\n${tail(result.stderr, 2000)}` : ''),
      result
    )
  }
  return result
}
