import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerQuizHandlers } from '../../../features/quiz/quizCliHandler'
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { APP_CONFIG } from '../../../app/constants'

// Mock dependencies
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
    },
    app: {
        getPath: vi.fn().mockReturnValue('/mock/app/path'),
    }
}))

vi.mock('fs', () => {
    const promisesMock = {
        stat: vi.fn(),
        open: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        rename: vi.fn(),
        unlink: vi.fn(),
        copyFile: vi.fn(),
    };
    return {
        default: { promises: promisesMock },
        promises: promisesMock,
    }
})

vi.mock('../../../core/ConfigManager', () => ({
    ConfigManager: vi.fn().mockImplementation(function () {
        return {
            read: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
        }
    })
}))

vi.mock('../../../core/helpers', () => ({
    getQuizSettingsPath: vi.fn().mockReturnValue('/mock/settings/path.json'),
}))

vi.mock('../../../features/quiz/geminiService', () => ({
    getGeminiCliPath: vi.fn().mockReturnValue('/mock/gemini/cli'),
    findGeminiCliPath: vi.fn().mockResolvedValue('/mock/gemini/cli'),
    executeGeminiCli: vi.fn().mockResolvedValue([{ question: 'Test?', options: ['A', 'B'], answer: 'A' }]),
    generateOutputFilePath: vi.fn().mockReturnValue('/mock/temp/output.json'),
}))

vi.mock('../../../features/quiz/promptBuilder', () => ({
    buildQuizPrompt: vi.fn().mockReturnValue('Mock Prompt'),
}))

describe('quizCliHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should register IPC handlers', () => {
        registerQuizHandlers()

        // Assert that ipcMain.handle was called for expected channels
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.GET_GEMINI_CLI_PATH, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.OPEN_GEMINI_LOGIN, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.CHECK_GEMINI_AUTH, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.GEMINI_LOGOUT, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.GET_QUIZ_SETTINGS, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.SAVE_QUIZ_SETTINGS, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.GENERATE_QUIZ_CLI, expect.any(Function))
        expect(ipcMain.handle).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.ASK_AI, expect.any(Function))
    })

    // Add more tests to simulate the handlers specifically
    it('GET_GEMINI_CLI_PATH handler should return valid path', async () => {
        registerQuizHandlers()
        const getCliPathCall = vi.mocked(ipcMain.handle).mock.calls.find(call => call[0] === APP_CONFIG.IPC_CHANNELS.GET_GEMINI_CLI_PATH)
        expect(getCliPathCall).toBeDefined()

        const handler = getCliPathCall![1]
        const result = await handler({} as any, [])
        expect(result).toEqual({ path: '/mock/gemini/cli', exists: true })
    })
})
