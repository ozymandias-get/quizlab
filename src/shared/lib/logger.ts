/**
 * Simple Logger wrapper to prevent console pollution in production.
 * Only logs in development environment.
 */
const isDev = process.env.NODE_ENV === 'development'
const LOG_BUFFER_LIMIT = 400

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
}

const logBuffer: LogEntry[] = []

function normalizeArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        const stack = arg.stack ? `\n${arg.stack}` : ''
        return `${arg.name}: ${arg.message}${stack}`
      }
      if (typeof arg === 'string') return arg
      if (arg === null) return 'null'
      if (arg === undefined) return 'undefined'

      try {
        return JSON.stringify(arg, null, 2)
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

  if (isDev) {
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

export const Logger = {
  warn: (...args: unknown[]) => {
    pushToBuffer('warn', args)
    if (isDev) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    pushToBuffer('error', args)
    console.error(...args)
  },
  info: (...args: unknown[]) => {
    pushToBuffer('info', args)
    if (isDev) console.info(...args)
  }
}
