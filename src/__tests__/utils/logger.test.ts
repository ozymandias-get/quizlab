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

        // Dynamic import to re-evaluate module with new ENV
        const { Logger } = await import('@src/utils/logger')

        const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => { })
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })

        Logger.info('test info')
        expect(consoleInfo).toHaveBeenCalledWith('test info')

        Logger.warn('test warn')
        expect(consoleWarn).toHaveBeenCalledWith('test warn')
    })

    it('should suppress info/warn in production/test environment', async () => {
        process.env.NODE_ENV = 'production'

        // This relies on the module re-evaluating process.env.NODE_ENV at top level
        const { Logger } = await import('@src/utils/logger')

        const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => { })
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })

        Logger.info('should be hidden')
        expect(consoleInfo).not.toHaveBeenCalled()

        Logger.warn('should be hidden')
        expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('should always log errors regardless of environment', async () => {
        process.env.NODE_ENV = 'production'
        const { Logger } = await import('@src/utils/logger')

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })

        Logger.error('critical error')
        expect(consoleError).toHaveBeenCalledWith('critical error')
    })
})
