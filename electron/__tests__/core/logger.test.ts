import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalNodeEnv = process.env.NODE_ENV

async function loadLogger() {
  // `isDev` is captured at module load time, so reset the module registry
  // after each NODE_ENV change to force a re-evaluation.
  vi.resetModules()
  return import('../../core/logger.js')
}

describe('electron/core/logger', () => {
  beforeEach(() => {
    // Buffer carries between modules — clear via the public API each test.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.restoreAllMocks()
    vi.resetModules()
    delete (globalThis as any).window
  })

  describe('Logger.warn', () => {
    it('forwards to console.warn in development', async () => {
      process.env.NODE_ENV = 'development'
      const { Logger } = await loadLogger()

      Logger.warn('hello', 'world')
      expect(console.warn).toHaveBeenCalledWith('hello', 'world')
    })

    it('suppresses console.warn in production but still buffers', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()

      Logger.warn('silent', 'warning')
      expect(console.warn).not.toHaveBeenCalled()
      const logs = getRecentElectronLogs()
      expect(logs[logs.length - 1]).toMatchObject({ level: 'warn' })
    })
  })

  describe('Logger.error', () => {
    it('always forwards to console.error regardless of NODE_ENV', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger } = await loadLogger()

      Logger.error('boom', new Error('explode'))
      expect(console.error).toHaveBeenCalledWith('boom', expect.any(Error))
    })

    it('also forwards in development', async () => {
      process.env.NODE_ENV = 'development'
      const { Logger } = await loadLogger()

      Logger.error('dev', 'fail')
      expect(console.error).toHaveBeenCalledWith('dev', 'fail')
    })
  })

  describe('Logger.info', () => {
    it('forwards in development only', async () => {
      process.env.NODE_ENV = 'development'
      const { Logger } = await loadLogger()

      Logger.info('info-msg')
      expect(console.info).toHaveBeenCalledWith('info-msg')
    })

    it('suppresses in production', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger } = await loadLogger()

      Logger.info('silent-info')
      expect(console.info).not.toHaveBeenCalled()
    })
  })

  describe('Logger.trace and Logger.debug', () => {
    it('does not forward trace to console in development (below default threshold)', async () => {
      process.env.NODE_ENV = 'development'
      const { Logger, getRecentElectronLogs } = await loadLogger()
      Logger.trace('trace-msg')
      expect(console.debug).not.toHaveBeenCalled()
      const logs = getRecentElectronLogs()
      expect(logs[logs.length - 1].message).toContain('trace-msg')
    })

    it('forwards debug to console.debug in development', async () => {
      process.env.NODE_ENV = 'development'
      const { Logger } = await loadLogger()
      Logger.debug('debug-msg')
      expect(console.debug).toHaveBeenCalledWith('debug-msg')
    })

    it('suppresses trace in production', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger } = await loadLogger()
      Logger.trace('silent-trace')
      expect(console.debug).not.toHaveBeenCalled()
    })

    it('suppresses debug in production', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger } = await loadLogger()
      Logger.debug('silent-debug')
      expect(console.debug).not.toHaveBeenCalled()
    })
  })

  describe('reportSuppressedError', () => {
    it('logs at debug level in development', async () => {
      process.env.NODE_ENV = 'development'
      const { reportSuppressedError } = await loadLogger()

      reportSuppressedError('test.scope', { cause: new Error('ignored') })
      expect(console.debug).toHaveBeenCalledWith('[Suppressed]', 'test.scope', expect.any(Error))
    })

    it('does not log in production but still buffers', async () => {
      process.env.NODE_ENV = 'production'
      const { reportSuppressedError, getRecentElectronLogs } = await loadLogger()

      reportSuppressedError('prod.scope')
      expect(console.debug).not.toHaveBeenCalled()
      const logs = getRecentElectronLogs()
      expect(logs[logs.length - 1]).toMatchObject({ level: 'info' })
    })

    it('marks missing cause as "(no cause)"', async () => {
      process.env.NODE_ENV = 'production'
      const { reportSuppressedError, getRecentElectronLogs } = await loadLogger()

      reportSuppressedError('no.cause.scope')
      const logs = getRecentElectronLogs()
      expect(logs[logs.length - 1].message).toContain('(no cause)')
    })
  })

  describe('getRecentElectronLogs', () => {
    it('returns the tail of the buffer in insertion order', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()

      Logger.error('first')
      Logger.error('second')
      Logger.error('third')
      const tail = getRecentElectronLogs(2)
      expect(tail.map((entry) => entry.message)).toEqual(['second', 'third'])
    })

    it('returns [] for non-positive limits', async () => {
      const { getRecentElectronLogs } = await loadLogger()
      expect(getRecentElectronLogs(0)).toEqual([])
      expect(getRecentElectronLogs(-1)).toEqual([])
    })
  })

  describe('redactSensitive', () => {
    it('redacts home directory paths', async () => {
      const { redactSensitive } = await loadLogger()
      expect(redactSensitive('/home/alice/config.json')).toContain('[REDACTED_HOME]')
      expect(redactSensitive('C:\\Users\\bob\\app.log')).toContain('[REDACTED_HOME]')
      expect(redactSensitive('/Users/charlie/.ssh/key')).toContain('[REDACTED_HOME]')
    })

    it('redacts API keys and secrets', async () => {
      const { redactSensitive } = await loadLogger()
      expect(redactSensitive('api_key=sk-1234567890abcdef')).toContain('api_key=[REDACTED]')
      expect(redactSensitive('password: supersecret')).toContain('password=[REDACTED]')
      expect(redactSensitive('token=ghp_abc123')).toContain('token=[REDACTED]')
    })

    it('redacts private IP addresses', async () => {
      const { redactSensitive } = await loadLogger()
      expect(redactSensitive('10.0.0.1')).toContain('[REDACTED_IP]')
      expect(redactSensitive('192.168.1.100')).toContain('[REDACTED_IP]')
      expect(redactSensitive('127.0.0.1')).toContain('[REDACTED_IP]')
    })

    it('returns original text when no patterns match', async () => {
      const { redactSensitive } = await loadLogger()
      expect(redactSensitive('hello world')).toBe('hello world')
      expect(redactSensitive('')).toBe('')
    })
  })

  describe('normalizeArgs (indirect via Logger)', () => {
    it('handles Error objects with stack traces', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()
      const err = new Error('test error')
      Logger.error('caught:', err)
      const logs = getRecentElectronLogs()
      const msg = logs[logs.length - 1].message
      expect(msg).toContain('Error: test error')
      expect(msg).toContain('logger.test')
    })

    it('handles null and undefined arguments', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()
      Logger.warn('values:', null, undefined)
      const logs = getRecentElectronLogs()
      const msg = logs[logs.length - 1].message
      expect(msg).toContain('null')
      expect(msg).toContain('undefined')
    })

    it('handles objects with circular references gracefully', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()
      const circular: Record<string, unknown> = { name: 'circle' }
      circular.self = circular
      Logger.error('circular:', circular)
      const logs = getRecentElectronLogs()
      const msg = logs[logs.length - 1].message
      expect(msg).toContain('circular:')
    })

    it('redacts sensitive strings in arguments', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()
      Logger.error('key:', 'api_key=secret123')
      const logs = getRecentElectronLogs()
      const msg = logs[logs.length - 1].message
      expect(msg).toContain('api_key=[REDACTED]')
    })
  })

  describe('pushToLoggerBuffer', () => {
    it('adds a pre-formatted entry directly to the buffer', async () => {
      const { pushToLoggerBuffer, getRecentElectronLogs } = await loadLogger()
      pushToLoggerBuffer('info', 'direct-entry', '2024-01-01T00:00:00.000Z')
      const logs = getRecentElectronLogs()
      expect(logs[logs.length - 1]).toMatchObject({
        level: 'info',
        message: 'direct-entry',
        timestamp: '2024-01-01T00:00:00.000Z'
      })
    })

    it('uses current timestamp when not provided', async () => {
      const { pushToLoggerBuffer, getRecentElectronLogs } = await loadLogger()
      pushToLoggerBuffer('warn', 'auto-timestamp')
      const logs = getRecentElectronLogs()
      expect(logs[logs.length - 1].timestamp).toBeDefined()
    })
  })

  describe('buffer overflow', () => {
    it('trims buffer when exceeding limit', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger, getRecentElectronLogs } = await loadLogger()
      for (let i = 0; i < 500; i++) {
        Logger.info(`entry-${i}`)
      }
      const logs = getRecentElectronLogs(500)
      expect(logs.length).toBe(400)
      expect(logs[0].message).toBe('entry-100')
      expect(logs[logs.length - 1].message).toBe('entry-499')
    })
  })

  describe('forwardToMain', () => {
    it('forwards warn/error to electronAPI.log in production when available', async () => {
      process.env.NODE_ENV = 'production'
      const mockLog = vi.fn()
      ;(globalThis as any).window = { electronAPI: { log: mockLog } } as any
      const { Logger } = await loadLogger()
      Logger.warn('prod-warn')
      expect(mockLog).toHaveBeenCalledWith('warn', 'prod-warn', expect.any(String))
    })

    it('does not forward info/debug/trace to electronAPI.log in production', async () => {
      process.env.NODE_ENV = 'production'
      const mockLog = vi.fn()
      ;(globalThis as any).window = { electronAPI: { log: mockLog } } as any
      const { Logger } = await loadLogger()
      Logger.info('prod-info')
      expect(mockLog).not.toHaveBeenCalled()
    })

    it('does not crash when electronAPI is missing', async () => {
      process.env.NODE_ENV = 'production'
      const { Logger } = await loadLogger()
      expect(() => Logger.warn('no-api')).not.toThrow()
    })

    it('forwards all levels to electronAPI.log in development', async () => {
      process.env.NODE_ENV = 'development'
      const mockLog = vi.fn()
      ;(globalThis as any).window = { electronAPI: { log: mockLog } } as any
      const { Logger } = await loadLogger()
      Logger.debug('dev-debug')
      Logger.info('dev-info')
      Logger.warn('dev-warn')
      Logger.error('dev-error')
      expect(mockLog).toHaveBeenCalledTimes(4)
    })
  })

  describe('createIssueLogReport', () => {
    it('generates a report with environment section', async () => {
      const { Logger, createIssueLogReport } = await loadLogger()
      Logger.error('test error for report')
      const report = createIssueLogReport({ appVersion: '1.0.0', language: 'en' })
      expect(report).toContain('Quizlab Reader Error Report')
      expect(report).toContain('App Version: 1.0.0')
      expect(report).toContain('Language: en')
      expect(report).toContain('test error for report')
    })

    it('shows "No buffered logs" when buffer is empty', async () => {
      const { createIssueLogReport } = await loadLogger()
      const report = createIssueLogReport({ appVersion: '0.0.0', language: 'tr' })
      expect(report).toContain('No buffered logs yet.')
    })
  })

  describe('initLogger', () => {
    it('returns early when userDataPath is not provided', async () => {
      const { initLogger } = await loadLogger()
      expect(() => initLogger()).not.toThrow()
      expect(() => initLogger({})).not.toThrow()
    })

    it('does not throw when userDataPath is provided but fs not available', async () => {
      const { initLogger } = await loadLogger()
      expect(() => initLogger({ userDataPath: '/tmp/test-logs', logToDisk: true })).not.toThrow()
    })
  })
})
