import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Logger Utility', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('should log info/warn in development environment', async () => {
    process.env.NODE_ENV = 'development'

    const { Logger } = await import('@shared/lib/logger')

    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    Logger.info('test info')
    expect(consoleInfo).toHaveBeenCalledWith('test info')

    Logger.warn('test warn')
    expect(consoleWarn).toHaveBeenCalledWith('test warn')
  })

  it('should suppress info/warn in production/test environment', async () => {
    process.env.NODE_ENV = 'production'

    const { Logger } = await import('@shared/lib/logger')

    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    Logger.info('should be hidden')
    expect(consoleInfo).not.toHaveBeenCalled()

    Logger.warn('should be hidden')
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('should always log errors regardless of environment', async () => {
    process.env.NODE_ENV = 'production'
    const { Logger } = await import('@shared/lib/logger')

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    Logger.error('critical error')
    expect(consoleError).toHaveBeenCalledWith('critical error')
  })
})

describe('createIssueLogReport', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('formats report with environment, unknown user agent when navigator is missing, and empty logs placeholder', async () => {
    vi.stubGlobal('navigator', undefined)
    const { createIssueLogReport } = await import('@shared/lib/logger')

    const report = createIssueLogReport({ appVersion: '3.0.5', language: 'en' })

    expect(report).toContain('# Quizlab Reader Error Report')
    expect(report).toContain('- App Version: 3.0.5')
    expect(report).toContain('- Language: en')
    expect(report).toContain('- User Agent: unknown')
    expect(report).toContain('## Recent Logs')
    expect(report).toContain('No buffered logs yet.')
  })

  it('embeds buffered warn and error lines', async () => {
    process.env.NODE_ENV = 'production'
    const { Logger, createIssueLogReport } = await import('@shared/lib/logger')

    Logger.warn('line one')
    Logger.error('line two')

    const report = createIssueLogReport({ appVersion: '1.0.0', language: 'tr' })

    expect(report).toContain('- App Version: 1.0.0')
    expect(report).toContain('- Language: tr')
    expect(report).toMatch(/\[WARN\].*line one/s)
    expect(report).toMatch(/\[ERROR\].*line two/s)
  })
})
