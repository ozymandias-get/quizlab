import { beforeEach, describe, expect, it, vi } from 'vitest'

const shellOpenExternal = vi.fn()

vi.mock('electron', () => ({
    BrowserWindow: vi.fn(),
    dialog: {
        showErrorBox: vi.fn()
    },
    session: {
        defaultSession: {
            setPermissionRequestHandler: vi.fn(),
            setPermissionCheckHandler: vi.fn()
        },
        fromPartition: vi.fn(() => ({
            webRequest: {
                onBeforeSendHeaders: vi.fn()
            },
            setPermissionRequestHandler: vi.fn(),
            setPermissionCheckHandler: vi.fn()
        }))
    },
    app: {
        isPackaged: false,
        getPath: vi.fn(() => '/mock-user-data'),
        getAppPath: vi.fn(() => '/mock-app')
    },
    screen: {
        getDisplayMatching: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })),
        getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1920, height: 1080 } }))
    },
    shell: {
        openExternal: shellOpenExternal
    }
}))

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true)
    }
}))

vi.mock('../../features/ai/aiManager', () => ({
    AI_REGISTRY: {},
    INACTIVE_PLATFORMS: {}
}))

vi.mock('../../core/ConfigManager', () => ({
    ConfigManager: vi.fn().mockImplementation(function () {
        return {
            read: vi.fn().mockResolvedValue({}),
            write: vi.fn().mockResolvedValue(undefined)
        }
    })
}))

describe('windowManager navigation hardening', () => {
    beforeEach(() => {
        shellOpenExternal.mockReset()
    })

    it('allows only dev-server origin for main-frame navigation in dev', async () => {
        const module = await import('../../app/windowManager.js')

        expect(module.isAllowedMainFrameUrl('http://localhost:5173/dashboard')).toBe(true)
        expect(module.isAllowedMainFrameUrl('https://example.com')).toBe(false)
        expect(module.isAllowedMainFrameUrl('http://localhost:4173')).toBe(false)
    })

    it('accepts safe external URLs but rejects unsafe schemes', async () => {
        const module = await import('../../app/windowManager.js')

        expect(module.isSafeExternalUrl('https://example.com')).toBe(true)
        expect(module.isSafeExternalUrl('mailto:test@example.com')).toBe(false)
        expect(module.isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    })

    it('redirects unsafe main-frame navigation to the external browser', async () => {
        const module = await import('../../app/windowManager.js')
        const listeners = new Map<string, (event: { preventDefault: () => void }, url: string) => void>()
        const setWindowOpenHandler = vi.fn()
        const on = vi.fn((event: string, handler: (event: { preventDefault: () => void }, url: string) => void) => {
            listeners.set(event, handler)
        })
        const preventDefault = vi.fn()

        module.hardenWindowWebContents({
            webContents: {
                setWindowOpenHandler,
                on
            }
        } as never)

        const willNavigate = listeners.get('will-navigate')
        expect(willNavigate).toBeTypeOf('function')

        willNavigate?.({ preventDefault }, 'https://example.com/docs')

        expect(preventDefault).toHaveBeenCalledTimes(1)
        expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/docs')
    })
})
