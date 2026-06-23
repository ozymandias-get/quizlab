/**
 * Simple Logger wrapper to prevent console pollution in production.
 * Only logs in development environment.
 *
 * Mirrors the public API used by both renderer and Electron main process.
 * Electron main process imports via relative path (../../src/shared/lib/logger).
 */

const LOG_BUFFER_LIMIT = 400

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
}

const logBuffer: LogEntry[] = []

// SECURITY: Patterns to redact from log output to prevent leaking sensitive
// user data (home directories, API keys, internal IPs, etc.) into plaintext
// log files.
const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Home directory paths: /home/username, /Users/username, C:\Users\username
  {
    pattern: /(\/home\/[^\s/]+|\/users\/[^\s/]+|[a-z]:\\users\\[^\s\\]+)/gi,
    replacement: '[REDACTED_HOME]'
  },
  // API keys, bearer tokens, and secrets (common patterns)
  {
    pattern: /(api[_-]?key|apikey|secret|password|token|bearer)\s*[:=]\s*["']?[^\s"']+["']?/gi,
    replacement: '$1=[REDACTED]'
  },
  // Private IP addresses
  {
    pattern:
      /\b(10(?:\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|127(?:\.\d{1,3}){3})\b/g,
    replacement: '[REDACTED_IP]'
  }
]

function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

const DEFAULT_LOG_LEVEL: LogLevel = isDev() ? 'debug' : 'info'
let currentLevel: LogLevel = DEFAULT_LOG_LEVEL

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[currentLevel]
}

/**
 * Redact sensitive data patterns from a string before logging.
 */
export function redactSensitive(text: string): string {
  let sanitized = text
  for (const { pattern, replacement } of REDACT_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement)
  }
  return sanitized
}

function normalizeArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        const stack = arg.stack ? `\n${arg.stack}` : ''
        return `${arg.name}: ${arg.message}${stack}`
      }
      if (typeof arg === 'string') return redactSensitive(arg)
      if (arg === null) return 'null'
      if (arg === undefined) return 'undefined'

      try {
        return redactSensitive(JSON.stringify(arg, null, 2))
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

function pushToBuffer(level: LogLevel, args: unknown[]) {
  logBuffer.push({
    timestamp: new Date().toISOString(),
    level,
    message: normalizeArgs(args)
  })

  if (logBuffer.length > LOG_BUFFER_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_LIMIT)
  }
}

function getRecentLogs(limit: number = 120): LogEntry[] {
  if (limit <= 0) return []
  return logBuffer.slice(-limit)
}

/**
 * Record intentionally suppressed errors in the issue-report buffer without surfacing them to users.
 */
export function reportSuppressedError(scope: string, options?: { cause?: unknown }): void {
  const cause = options?.cause
  pushToBuffer('info', [`[Suppressed:${scope}]`, cause !== undefined ? cause : '(no cause)'])

  if (isDev()) {
    console.debug('[Suppressed]', scope, cause)
  }
}

export function createIssueLogReport(params: { appVersion: string; language: string }): string {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  const now = new Date().toISOString()
  const logs = getRecentLogs(120)
  const logsBlock =
    logs.length > 0
      ? logs
          .map((entry) => `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`)
          .join('\n')
      : 'No buffered logs yet.'

  return [
    '# Quizlab Reader Error Report',
    '',
    '## Environment',
    `- App Version: ${params.appVersion}`,
    `- Language: ${params.language}`,
    `- Timestamp: ${now}`,
    `- User Agent: ${userAgent}`,
    '',
    '## Reproduction Steps',
    '1.',
    '2.',
    '3.',
    '',
    '## Expected Behavior',
    '',
    '## Actual Behavior',
    '',
    '## Recent Logs',
    '```text',
    logsBlock,
    '```'
  ].join('\n')
}

/**
 * Read-only view of the recent log buffer; useful for diagnostic dumps at
 * shutdown or when a crash dump is requested.
 */
export function getRecentElectronLogs(limit?: number): ReadonlyArray<LogEntry> {
  return getRecentLogs(limit)
}

// ── Buffer access for electron disk logger ─────────────────────

export function getPendingLogEntries(fromIndex: number): LogEntry[] {
  return logBuffer.slice(fromIndex)
}

export function getLogBufferLength(): number {
  return logBuffer.length
}

/**
 * Internal API: push a pre-formatted log entry directly into the buffer.
 * Used by the Electron IPC handler to forward renderer logs into the main
 * process buffer without re-normalizing.
 */
export function pushToLoggerBuffer(level: LogLevel, message: string, timestamp?: string): void {
  logBuffer.push({
    timestamp: timestamp || new Date().toISOString(),
    level,
    message
  })

  if (logBuffer.length > LOG_BUFFER_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_LIMIT)
  }
}

function forwardToMain(level: LogLevel, args: unknown[]) {
  // SECURITY/PERFORMANCE: In production, only forward warn and error logs
  // to the main process. Trace/debug/info logs generate unnecessary IPC
  // traffic that can impact performance on high-frequency operations.
  if (!isDev() && level !== 'warn' && level !== 'error') return

  // Silently check for Electron API — avoids the console.warn side-effect in getElectronApi()
  const api = typeof window !== 'undefined' && (window as any).electronAPI
  if (!api || typeof api.log !== 'function') return
  const message = normalizeArgs(args)
  api.log(level, message, new Date().toISOString())
}

function devConsole(level: LogLevel, args: unknown[]) {
  if (!isDev()) return
  if (!shouldLog(level)) return

  switch (level) {
    case 'trace':
    case 'debug':
      console.debug(...args)
      break
    case 'info':
      console.info(...args)
      break
    case 'warn':
      console.warn(...args)
      break
    case 'error':
      console.error(...args)
      break
  }
}

export const Logger = {
  trace: (...args: unknown[]) => {
    pushToBuffer('trace', args)
    forwardToMain('trace', args)
    devConsole('trace', args)
  },
  debug: (...args: unknown[]) => {
    pushToBuffer('debug', args)
    forwardToMain('debug', args)
    devConsole('debug', args)
  },
  info: (...args: unknown[]) => {
    pushToBuffer('info', args)
    forwardToMain('info', args)
    devConsole('info', args)
  },
  warn: (...args: unknown[]) => {
    pushToBuffer('warn', args)
    forwardToMain('warn', args)
    devConsole('warn', args)
  },
  error: (...args: unknown[]) => {
    pushToBuffer('error', args)
    forwardToMain('error', args)
    // error always logs to console in both dev and prod (but respects level gate)
    if (shouldLog('error')) console.error(...args)
  }
}
