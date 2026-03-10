import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../../../app/constants'

const ipcHandle = vi.fn()

const managerState: {
    data: Record<string, unknown>;
    writes: Record<string, unknown>[];
} = {
    data: {},
    writes: []
}

vi.mock('electron', () => ({
    ipcMain: {
        handle: ipcHandle
    }
}))

vi.mock('../../../core/helpers', () => ({
    getAiConfigPath: vi.fn(() => 'C:/tmp/ai_custom_selectors.json')
}))

vi.mock('../../../core/ConfigManager', () => ({
    ConfigManager: class<T extends Record<string, unknown>> {
        constructor(_filePath: string) {}

        async read(): Promise<T> {
            return managerState.data as T
        }

        async write(data: T): Promise<boolean> {
            managerState.data = data
            managerState.writes.push(JSON.parse(JSON.stringify(data)) as Record<string, unknown>)
            return true
        }

        async deleteItem(key: string): Promise<boolean> {
            const next = { ...managerState.data }
            delete next[key]
            managerState.data = next
            managerState.writes.push(JSON.parse(JSON.stringify(next)) as Record<string, unknown>)
            return true
        }
    }
}))

function getHandler(channel: string) {
    return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('aiConfigHandlers', () => {
    beforeEach(() => {
        vi.resetModules()
        ipcHandle.mockReset()
        managerState.data = {}
        managerState.writes = []
    })

    it('migrates legacy selector records and resolves unique canonical host aliases', async () => {
        managerState.data = {
            'www.chat.openai.com': {
                input: '#prompt',
                button: '#send',
                submitMode: 'enter',
                timestamp: 123
            }
        }

        const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
        registerAiConfigHandlers()

        const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)

        const allConfigs = await getConfigHandler?.({}, undefined)
        const aliasConfig = await getConfigHandler?.({}, 'app.openai.com')

        expect(managerState.writes).toHaveLength(1)
        expect(allConfigs).toMatchObject({
            'www.chat.openai.com': {
                version: 2,
                input: '#prompt',
                button: '#send',
                inputCandidates: ['#prompt'],
                buttonCandidates: ['#send'],
                canonicalHostname: 'openai.com',
                sourceHostname: 'www.chat.openai.com',
                submitMode: 'enter_key',
                health: 'migrated'
            }
        })
        expect(aliasConfig).toMatchObject({
            input: '#prompt',
            button: '#send',
            canonicalHostname: 'openai.com',
            submitMode: 'enter_key',
            health: 'migrated'
        })
    })

    it('marks incomplete legacy configs as needs_repick during migration', async () => {
        managerState.data = {
            'claude.ai': {
                input: '#composer',
                submitMode: 'enter'
            }
        }

        const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
        registerAiConfigHandlers()

        const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)
        const allConfigs = await getConfigHandler?.({}, undefined)

        expect(allConfigs).toMatchObject({
            'claude.ai': {
                version: 2,
                input: '#composer',
                inputCandidates: ['#composer'],
                button: null,
                buttonCandidates: null,
                submitMode: 'enter_key',
                canonicalHostname: 'claude.ai',
                sourceHostname: 'claude.ai',
                health: 'needs_repick'
            }
        })
    })

    it('merges partial saves field-by-field without dropping existing selectors', async () => {
        managerState.data = {
            'claude.ai': {
                version: 2,
                input: '#composer',
                button: '#send',
                waitFor: '#composer',
                submitMode: 'mixed',
                inputCandidates: ['#composer'],
                buttonCandidates: ['#send'],
                sourceHostname: 'claude.ai',
                canonicalHostname: 'claude.ai',
                health: 'ready',
                timestamp: 10
            }
        }

        const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
        registerAiConfigHandlers()

        const saveConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SAVE_AI_CONFIG)
        const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)

        const saved = await saveConfigHandler?.({}, 'claude.ai', {
            submitMode: 'click'
        })
        const config = await getConfigHandler?.({}, 'claude.ai')

        expect(saved).toBe(true)
        expect(config).toMatchObject({
            version: 2,
            input: '#composer',
            button: '#send',
            waitFor: '#composer',
            inputCandidates: ['#composer'],
            buttonCandidates: ['#send'],
            submitMode: 'click',
            health: 'ready'
        })
    })
})
