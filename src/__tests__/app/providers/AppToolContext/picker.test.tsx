import { vi } from 'vitest'

import { mockState } from './mockState'

vi.mock('@app/providers/ai-context', () => ({
  useAiMessagingActions: () => ({
    sendTextToAI: (...args: any[]) => (mockState.sendTextToAI as any)(...args),
    sendImageToAI: (...args: any[]) => (mockState.sendImageToAI as any)(...args),
    cancelOngoing: vi.fn()
  }),
  useAiSessionActions: () => ({ setAutoSend: vi.fn() }),
  useAiState: () => ({ autoSend: mockState.autoSend }),
  useAiSessionUiPrefsState: () => ({
    autoSend: mockState.autoSend,
    isTutorialActive: false
  }),
  useAiContent: () => ({
    getContentController: () => mockState.contentController
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: (...args: any[]) => (mockState.showError as any)(...args),
    showWarning: (...args: any[]) => (mockState.showWarning as any)(...args)
  })
}))

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: () => ({
    isScreenshotMode: false,
    startScreenshot: vi.fn(),
    closeScreenshot: vi.fn(),
    handleCapture: vi.fn()
  })
}))

vi.mock('@features/automation', () => ({
  useElementPicker: () => ({
    isPickerActive: false,
    startPicker: (...args: any[]) => (mockState.startPicker as any)(...args),
    togglePicker: vi.fn()
  })
}))

vi.mock('@app/providers/app-tool/aiContentPickerReadiness', () => ({
  oncePickerReady: vi.fn().mockResolvedValue('dom-ready'),
  waitForContentReady: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
  GEMINI_WEB_REQUIRES_LOGIN_ERROR: 'error_refresh_failed_requires_login',
  GEMINI_WEB_STATUS_KEY: ['gemini-web', 'status'],
  useGeminiWebOpenLogin: () => ({
    mutateAsync: (...args: any[]) => (mockState.mutateAsync as any)(...args),
    isPending: mockState.geminiLoginPending
  })
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => ({
    geminiWeb: {
      onRefreshEvent: (callback: (...args: any[]) => void) => {
        mockState.onRefreshEvent(callback)
        return () => {} // return a proper unsubscribe function
      }
    }
  })
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: (...args: any[]) => (mockState.invalidateQueries as any)(...args)
    })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

import AppToolProvider, { useAppTools } from '@app/providers/AppToolContext'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('AppToolContext - picker', () => {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient()
    return (
      <QueryClientProvider client={client}>
        <AppToolProvider>{children}</AppToolProvider>
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.contentController = null
  })

  it('starts the picker once the active content becomes ready', async () => {
    vi.useRealTimers()
    mockState.contentController = {
      isReady: () => true,
      isDestroyed: () => false,
      getURL: vi.fn(() => 'https://chat.openai.com'),
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    } as unknown as Element & {
      isReady: () => boolean
      isDestroyed: () => boolean
      getURL: () => string
      executeJavaScript: (s: string) => Promise<unknown>
    }
    const { result } = renderHook(() => useAppTools(), { wrapper })

    act(() => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockState.startPicker).toHaveBeenCalledTimes(1)
    vi.useFakeTimers()
  })
})
