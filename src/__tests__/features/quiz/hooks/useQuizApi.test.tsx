import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    useGenerateQuiz,
    useAskAssistant,
    useQuizSettings,
    useSaveSettings
} from '@platform/electron/api/useQuizApi'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Electron API
const mockGenerate = vi.fn()
const mockAskAssistant = vi.fn()
const mockGetSettings = vi.fn()
const mockSaveSettings = vi.fn()

const mockElectronAPI = {
    quiz: {
        generate: mockGenerate,
        askAssistant: mockAskAssistant,
        getSettings: mockGetSettings,
        saveSettings: mockSaveSettings
    }
}

// Ensure window.electronAPI is mocked
Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true
})

// Validation: mock useToast correctly by mocking the specific file path
vi.mock('../../../app/providers/ToastContext', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn()
    })
}))

// Also mock the alias path just in case
vi.mock('@src/app/providers/ToastContext', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn()
    })
}))

vi.mock('../../app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key
    })
}))

vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key
    })
}))


// Wrapper for QueryClientProvider
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                staleTime: 0
            },
            mutations: {
                retry: false
            }
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

describe('Quiz API Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useGenerateQuiz', () => {
        it('should call electronAPI.quiz.generate with correct parameters', async () => {
            const mockResult = { success: true, data: [{ id: '1', text: 'Test Question' }] }
            mockGenerate.mockResolvedValue(mockResult)

            const { result } = renderHook(() => useGenerateQuiz(), {
                wrapper: createWrapper(),
            })

            const variables = {
                pdfPath: 'test.pdf',
                settings: { difficulty: 'EASY' },
                language: 'en',
                failedQuestionsContext: [],
                previousQuestions: []
            }

            const res = await result.current.mutateAsync(variables as any)

            expect(mockGenerate).toHaveBeenCalledWith(variables)
            expect(res).toEqual(mockResult)
        })
    })

    describe('useAskAssistant', () => {
        it('should call electronAPI.quiz.askAssistant with correct parameters', async () => {
            const mockResponse = { success: true, data: 'This is the answer' }
            mockAskAssistant.mockResolvedValue(mockResponse)

            const { result } = renderHook(() => useAskAssistant(), {
                wrapper: createWrapper(),
            })

            const variables = {
                question: 'Question?',
                context: 'Context'
            }

            await result.current.mutateAsync(variables)

            expect(mockAskAssistant).toHaveBeenCalledWith(
                variables.question,
                variables.context
            )
        })
    })

    describe('useQuizSettings & useSaveSettings', () => {
        it('should return settings from API', async () => {
            const mockSettings = {
                difficulty: 'HARD',
                questionCount: 10
            }
            mockGetSettings.mockResolvedValue(mockSettings)

            const { result } = renderHook(() => useQuizSettings(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockSettings)
        })

        it('should call saveSettings mutation', async () => {
            const newSettings = {
                difficulty: 'EASY',
                questionCount: 3
            }
            mockSaveSettings.mockResolvedValue(true)

            const { result } = renderHook(() => useSaveSettings(), {
                wrapper: createWrapper(),
            })

            await result.current.mutateAsync(newSettings as any)

            expect(mockSaveSettings).toHaveBeenCalledWith(newSettings)
        })
    })
})

