import {
  AiProvider,
  AiRegistryMetaSliceContext,
  useAiContent,
  useAiContentHostActions,
  useAiMessagingActions,
  useAiModelActions,
  useAiModelsCatalog,
  useAiTabActions,
  useAiTabFocus,
  useAiTabsList,
  useAiViewRequestNonce
} from '@app/providers/ai-context'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { type ReactNode, useContext, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockShowSuccess = vi.fn()
const mockShowWarning = vi.fn()
const mockShowError = vi.fn()
const mockAddToast = vi.fn((_toast: Record<string, unknown>) => 'toast-id')

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning,
    showError: mockShowError,
    addToast: mockAddToast
  })
}))

const mockSendText = vi.fn()
const mockSendImage = vi.fn()

vi.mock('@shared/hooks', () => ({
  useLocalStorage: (_key: string, initial: any) => {
    const [val, setVal] = useState(initial)
    return [val, setVal]
  },
  useLocalStorageString: (_key: string, initial: any) => {
    const [val, setVal] = useState(initial)
    return [val, setVal]
  },
  useLocalStorageBoolean: (_key: string, initial: any) => {
    const [val, setVal] = useState(initial)
    const toggle = () => setVal(!val)
    return [val, setVal, toggle]
  }
}))

vi.mock('@features/ai/hooks/useAiSender', () => ({
  useAiSender: () => ({
    sendTextToAI: mockSendText,
    sendImageToAI: mockSendImage
  })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn() }
}))

/**
 * Test harness that mirrors the shape the removed wide `useAi()` aggregate hook
 * used to expose, but built from the narrow per-slice hooks that production
 * code actually consumes. `AiRegistryMetaSliceContext` has no narrow hook, so
 * it is read directly through `useContext`.
 */
const useAiHarness = () => {
  const registryMeta = useContext(AiRegistryMetaSliceContext)
  const tabsList = useAiTabsList()
  const tabFocus = useAiTabFocus()
  const viewRequestNonce = useAiViewRequestNonce()
  const modelsCatalog = useAiModelsCatalog()
  const modelActions = useAiModelActions()
  const tabActions = useAiTabActions()
  const contentHostActions = useAiContentHostActions()
  const messagingActions = useAiMessagingActions()
  const content = useAiContent()
  return {
    ...registryMeta,
    ...tabsList,
    ...tabFocus,
    aiViewRequestNonce: viewRequestNonce, // <- the narrow hook returns the NUMBER
    ...modelsCatalog,
    ...modelActions,
    ...tabActions,
    ...contentHostActions,
    ...messagingActions,
    ...content
  }
}

describe('AiContext', () => {
  const originalElectronAPI = window.electronAPI
  const mockGetAiRegistry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    window.electronAPI = {
      getAiRegistry: mockGetAiRegistry
    } as unknown as Window['electronAPI']

    mockGetAiRegistry.mockResolvedValue({
      aiRegistry: {
        chatgpt: { id: 'chatgpt', name: 'ChatGPT' },
        claude: { id: 'claude', name: 'Claude' }
      },
      defaultAiId: 'chatgpt',
      allAiIds: ['chatgpt', 'claude'],
      chromeUserAgent: 'Mozilla/5.0'
    })
  })

  afterEach(() => {
    window.electronAPI = originalElectronAPI
  })

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AiProvider>{children}</AiProvider>
      </QueryClientProvider>
    )
  }

  it('loads registry on mount', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isRegistryLoaded).toBe(true)
    })

    expect(mockGetAiRegistry).toHaveBeenCalled()
    expect(result.current.aiSites['chatgpt']).toBeDefined()
    expect(result.current.currentAI).toBe('chatgpt')
  })

  it('shows a retry surface instead of blanking the app when the registry fails', async () => {
    mockGetAiRegistry.mockRejectedValueOnce(new Error('registry unavailable'))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    render(
      <QueryClientProvider client={queryClient}>
        <AiProvider>
          <div>workspace</div>
        </AiProvider>
      </QueryClientProvider>
    )

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText('workspace')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('workspace')).toBeInTheDocument())
  })

  it('publishes favorite actions and updated selections through the shared model contexts', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))
    act(() => result.current.setEnabledModels(['chatgpt']))
    act(() => result.current.toggleFavoriteModel('claude'))
    expect(result.current.favoriteModels).toEqual(['claude'])
    expect(result.current.enabledModels).toEqual(['chatgpt', 'claude'])
    act(() => result.current.toggleFavoriteModel('claude'))
    expect(result.current.favoriteModels).toEqual([])
  })

  it('manages tabs (add, switch)', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    expect(result.current.tabs).toHaveLength(0)
    expect(result.current.activeTabId).toBe('')

    act(() => {
      result.current.addTab('chatgpt')
    })

    expect(result.current.tabs).toHaveLength(1)
    const firstTabId = result.current.activeTabId
    expect(result.current.currentAI).toBe('chatgpt')

    act(() => {
      result.current.addTab('claude')
    })

    expect(result.current.tabs).toHaveLength(2)
    expect(result.current.activeTabId).not.toBe(firstTabId)
    expect(result.current.currentAI).toBe('claude')

    act(() => {
      result.current.setActiveTab(firstTabId)
    })

    expect(result.current.activeTabId).toBe(firstTabId)
    expect(result.current.currentAI).toBe('chatgpt')
  })

  it('opens the requested AI workspace and bumps the reveal nonce', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    act(() => {
      result.current.openAiWorkspace('chatgpt')
    })

    const firstNonce = result.current.aiViewRequestNonce
    const firstTabId = result.current.activeTabId

    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.currentAI).toBe('chatgpt')
    expect(firstNonce).toBeGreaterThan(0)

    act(() => {
      result.current.openAiWorkspace('chatgpt')
    })

    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe(firstTabId)
    expect(result.current.aiViewRequestNonce).toBeGreaterThan(firstNonce)
  })

  it('closes tabs and returns to the home state when the last tab closes', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    act(() => {
      result.current.addTab('chatgpt')
      result.current.addTab('claude')
    })

    expect(result.current.tabs).toHaveLength(2)
    const firstTabId = result.current.tabs[0]?.id

    act(() => {
      result.current.setActiveTab(firstTabId)
    })
    expect(result.current.tabs).toHaveLength(2)

    const tabToClose = result.current.activeTabId

    act(() => {
      result.current.closeTab(tabToClose)
    })

    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.activeTabId).not.toBe(tabToClose)

    const lastTab = result.current.activeTabId
    act(() => {
      result.current.closeTab(lastTab)
    })

    expect(result.current.tabs).toHaveLength(0)
    expect(result.current.activeTabId).toBe('')
  })

  it('reorders tabs by drag position', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    act(() => {
      result.current.addTab('chatgpt')
      result.current.addTab('claude')
    })

    const [firstTab, secondTab] = result.current.tabs
    act(() => {
      result.current.setActiveTab(secondTab.id)
    })

    act(() => {
      result.current.moveTab(secondTab.id, firstTab.id, false)
    })

    expect(result.current.tabs.map((tab) => tab.id)).toEqual([secondTab.id, firstTab.id])
    // Reordering moves the pill, it does not change which tab is open.
    expect(result.current.activeTabId).toBe(secondTab.id)
  })

  it('wraps sending text with toast notifications', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    // Simulate normal user flow: open an AI workspace and register the content.
    // Without this, the auto-open path would wait for a content that never mounts
    // in the test environment (AiViewSurface is not rendered in this test).
    act(() => {
      result.current.openAiWorkspace('chatgpt')
    })
    const tabId = result.current.activeTabId
    act(() => {
      result.current.registerContent(tabId, {
        getURL: () => 'https://chatgpt.com',
        executeJavaScript: vi.fn().mockResolvedValue('complete'),
        isDestroyed: () => false
      } as any)
    })

    mockSendText.mockResolvedValue({ success: true })

    await act(async () => {
      await result.current.sendTextToAI('hello')
    })

    expect(mockSendText).toHaveBeenCalledWith('hello', undefined)
    expect(mockShowSuccess).not.toHaveBeenCalled()

    // A real pipeline code: toErrorToastKey maps codes the bundles do not know
    // to error_unknown_error, and the key mapping has its own tests. What this
    // test pins is that a failed send reaches the toast layer at all.
    mockSendText.mockResolvedValue({ success: false, error: 'send_failed' })
    await act(async () => {
      await result.current.sendTextToAI('fail')
    })
    expect(mockShowWarning).toHaveBeenCalledWith('error_send_failed')
  })

  it('does not let stale content cleanup remove a replacement instance', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    act(() => {
      result.current.openAiWorkspace('chatgpt')
    })
    const tabId = result.current.activeTabId
    const first = { getURL: () => 'https://chatgpt.com/first' }
    const replacement = { getURL: () => 'https://chatgpt.com/replacement' }

    act(() => {
      result.current.registerContent(tabId, first as never)
      result.current.registerContent(tabId, replacement as never)
      result.current.registerContent(tabId, null, first as never)
    })

    expect(result.current.getContentController(tabId)).toBe(replacement)
  })

  it('tears the closed tab down immediately', async () => {
    // Regression guard. Closing a tab used to only drop the registry entry, so
    // the main-process `WebContentsView` — and the Chromium renderer process
    // behind it — survived the tab that owned it. There is no undo window now,
    // so the cleanup starts as soon as the tab is closed.
    const mockDestroyView = vi.fn(async () => true)
    window.electronAPI = {
      getAiRegistry: mockGetAiRegistry,
      aiView: { destroy: mockDestroyView }
    } as unknown as Window['electronAPI']

    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    act(() => {
      result.current.openAiWorkspace('chatgpt')
    })
    const tabId = result.current.activeTabId

    act(() => {
      result.current.closeTab(tabId)
    })

    expect(mockDestroyView).toHaveBeenCalledWith({ viewId: tabId })
    expect(result.current.getContentController(tabId)).toBeNull()
    expect(result.current.tabs.find((tab) => tab.id === tabId)).toBeUndefined()
  })

  it('closes the tab without offering an undo toast', async () => {
    const { result } = renderHook(() => useAiHarness(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

    act(() => {
      result.current.openAiWorkspace('chatgpt')
    })
    const tabId = result.current.activeTabId

    act(() => {
      result.current.closeTab(tabId)
    })

    expect(mockAddToast).not.toHaveBeenCalled()
    expect(result.current.tabs.find((tab) => tab.id === tabId)).toBeUndefined()
  })
})
