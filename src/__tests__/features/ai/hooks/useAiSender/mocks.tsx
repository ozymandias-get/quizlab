import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AiPlatform } from '@shared-core/types'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

vi.mock('@shared/lib/aiContentUtils', () => ({
  safeContentPaste: vi.fn(async () => true)
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn()
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

export const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

export const mockScriptDiagnostics = {
  kind: 'auto_send' as const,
  pageUrl: 'https://openai.com/chat',
  totalMs: 12,
  input: {
    requestedSelector: '#input',
    matchedSelector: '#input',
    strategy: 'direct' as const,
    durationMs: 2,
    waitIterations: 1,
    cacheHits: 0,
    cacheInvalidations: 0,
    interactiveRequired: false
  },
  button: {
    requestedSelector: '#send',
    matchedSelector: '#send',
    strategy: 'direct' as const,
    durationMs: 1,
    waitIterations: 1,
    cacheHits: 0,
    cacheInvalidations: 0,
    interactiveRequired: true
  },
  setInputMs: 4,
  submitMs: 5,
  error: null
} as const

// A native paste is now addressed by managed view id: the controller's own
// paste() reaches webContents.paste() in the main process, so there is no
// webContentsId to leak into the renderer any more.
export const mockContent = {
  getURL: vi.fn(),
  executeJavaScript: vi.fn(),
  isDestroyed: vi.fn(() => false),
  focus: vi.fn(async () => true),
  paste: vi.fn(async () => true)
}

export const mockContentRef = { current: mockContent } as unknown as Parameters<
  typeof import('@features/ai/hooks/useAiSender').useAiSender
>[0]

export const mockAiRegistry: Record<string, AiPlatform> = {
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    url: 'https://chatgpt.com',
    input: '#input',
    button: '#send',
    submitMode: 'click',
    domainRegex: 'openai\\.com'
  }
}

export const mockGenerateAutoSendScript = vi.fn()
export const mockGenerateClickSendScript = vi.fn()
export const mockGenerateFocusScript = vi.fn()
export const mockGenerateWaitForSubmitReadyScript = vi.fn()
export const mockCopyImageToClipboard = vi.fn()
export const mockRestoreClipboard = vi.fn()
export const mockGetAiConfig = vi.fn()
