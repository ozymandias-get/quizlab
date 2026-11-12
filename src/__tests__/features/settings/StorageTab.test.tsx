/**
 * Render coverage for the Storage settings tab.
 *
 * The tab is a controller over four section components and one pure
 * view-model, so these tests pin the wiring the user actually sees: which
 * sections appear for a given cache-info payload, and which mutation each
 * control fires.
 */
import StorageTab from '@features/settings/ui/StorageTab'

import { TooltipProvider } from '@shared/ui/components/primitives'

import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The partition rows use tooltips, so the provider has to wrap every render. */
function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)
}

const {
  clearCache,
  clearPartitionCache,
  deepCleanCache,
  refetchCache,
  setCacheAutoClean,
  smartCacheAction
} = vi.hoisted(() => ({
  clearCache: vi.fn(),
  clearPartitionCache: vi.fn(),
  deepCleanCache: vi.fn(),
  refetchCache: vi.fn(),
  setCacheAutoClean: vi.fn(),
  smartCacheAction: vi.fn()
}))

const cacheInfo = { current: undefined as unknown }

vi.mock('@platform/electron/api/useSettingsSystemApi', () => ({
  useCacheInfo: () => ({ data: cacheInfo.current, refetch: refetchCache }),
  useClearCache: () => ({
    mutate: clearCache,
    isPending: false,
    isSuccess: false
  }),
  useClearPartitionCache: () => ({ mutate: clearPartitionCache }),
  useDeepCleanCache: () => ({ mutate: deepCleanCache, isPending: false }),
  useSetCacheAutoClean: () => ({ mutate: setCacheAutoClean }),
  useSmartCacheAction: () => ({ mutate: smartCacheAction, isPending: false })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
    i18n: { language: 'en' }
  })
}))

vi.mock('@ui/components/Icons', () => ({
  RefreshIcon: () => <div data-testid="icon-refresh" />
}))

function setCacheInfo(overrides: Record<string, unknown> = {}) {
  cacheInfo.current = {
    breakdown: {
      chromiumCache: 10,
      codeCache: 20,
      gpuCache: 30,
      partitionCaches: {},
      tempFiles: 40,
      total: 100
    },
    lastCleanup: null,
    lastCleanupResult: null,
    isIdle: false,
    ...overrides
  }
}

function makeSmart(
  overrides: Record<string, unknown> = {},
  recommendation: Record<string, unknown> = { action: 'clean_cold' }
) {
  return {
    pressureLevel: 'warning',
    pressurePercentage: 80,
    recommendation: {
      reason: 'cold partitions',
      targetPartitions: ['ai_chatgpt'],
      estimatedFreeBytes: 0,
      ...recommendation
    },
    partitionDetails: [],
    autoClean: { enabled: false, lastAutoCleanAt: null },
    ...overrides
  }
}

describe('StorageTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheInfo.current = undefined
  })

  it('hides the root cache section while the cache info is still loading', () => {
    render(<StorageTab />)

    expect(screen.queryByText('root_caches')).not.toBeInTheDocument()
    expect(screen.getByText('clear_cache_title')).toBeInTheDocument()
  })

  it('falls back to the byte budget for the pressure badge before a classification exists', () => {
    setCacheInfo()

    render(<StorageTab />)

    expect(screen.getByText(/^cache_pressure_normal · 0%$/)).toBeInTheDocument()
  })

  it('shows pressure from the byte budget and hides a "none" recommendation button', () => {
    setCacheInfo({
      breakdown: {
        chromiumCache: 0,
        codeCache: 0,
        gpuCache: 0,
        partitionCaches: {},
        tempFiles: 0,
        total: Math.ceil(1024 * 1024 * 1024 * 0.8)
      },
      smart: makeSmart({}, { action: 'none' })
    })

    render(<StorageTab />)

    expect(screen.getByText(/^cache_pressure_warning · 80%$/)).toBeInTheDocument()
    expect(screen.queryByText('smart_clean_cold')).not.toBeInTheDocument()
  })

  it('maps a recommendation to the right smart-cache action and label', async () => {
    setCacheInfo({ smart: makeSmart() })
    const { unmount } = render(<StorageTab />)

    fireEvent.click(screen.getByText('smart_clean_cold'))
    expect(smartCacheAction).toHaveBeenCalledWith('clean_cold')
    unmount()

    smartCacheAction.mockClear()
    deepCleanCache.mockClear()
    setCacheInfo({ smart: makeSmart({}, { action: 'deep_clean' }) })
    render(<StorageTab />)

    // `deep_clean` labels both the plain deep-clean button and the smart-clean
    // button, in that DOM order; the smart one is the follow-up control. A
    // recommendation that means "wipe everything" has to ask first.
    fireEvent.click(screen.getAllByText('deep_clean').at(-1) as HTMLElement)
    expect(smartCacheAction).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'deep_clean_confirm_action' }))
    await waitFor(() => expect(deepCleanCache).toHaveBeenCalled())
  })

  it('falls back to clean_cold when the recommendation action is unrecognised', () => {
    // The action string comes straight off the scheduler, so an unknown or empty
    // value must still reach the cache handler as the cold sweep rather than
    // being silently swallowed.
    setCacheInfo({ smart: makeSmart({}, { action: '' }) })
    const { unmount } = render(<StorageTab />)

    fireEvent.click(screen.getByText('smart_clean_cold'))
    expect(smartCacheAction).toHaveBeenCalledWith('clean_cold')
    unmount()

    smartCacheAction.mockClear()
    setCacheInfo({ smart: makeSmart({}, { action: 'something_new' }) })
    render(<StorageTab />)

    fireEvent.click(screen.getByText('smart_clean_cold'))
    expect(smartCacheAction).toHaveBeenCalledWith('clean_cold')
  })

  it('reports the auto-clean toggle state and forwards the change', () => {
    setCacheInfo({ smart: makeSmart() })

    render(<StorageTab />)

    const toggle = screen.getByLabelText('cache_auto_clean')
    expect(toggle).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(setCacheAutoClean).toHaveBeenCalledWith(true)
  })

  it('maps a partition row to its persistent partition key', () => {
    setCacheInfo({
      smart: makeSmart({
        partitionDetails: [
          { key: 'ai_chatgpt', size: 50_000, category: 'active', lastActive: 1, ttlMs: 0 }
        ]
      })
    })

    render(<StorageTab />)

    fireEvent.click(screen.getByLabelText('partition_clear_aria:{"name":"Chatgpt"}'))
    expect(clearPartitionCache).toHaveBeenCalledWith({ partition: 'persist:ai_chatgpt' })
  })

  it('fires the plain clear, deep clean and refresh mutations', async () => {
    setCacheInfo()

    render(<StorageTab />)

    fireEvent.click(screen.getByText('clear_cache'))
    expect(clearCache).toHaveBeenCalled()

    // Deep clean is session-destroying: it must ask before touching anything.
    fireEvent.click(screen.getByText('deep_clean'))
    expect(deepCleanCache).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'deep_clean_confirm_action' }))
    await waitFor(() => expect(deepCleanCache).toHaveBeenCalled())

    fireEvent.click(screen.getByText('refresh'))
    expect(refetchCache).toHaveBeenCalled()
  })

  it('names the AI sessions that the deep clean will sign out', async () => {
    setCacheInfo({
      smart: makeSmart({
        partitionDetails: [
          { key: 'ai_chatgpt', size: 50_000, category: 'active', lastActive: 1, ttlMs: 0 },
          { key: 'ai_gemini', size: 40_000, category: 'active', lastActive: 1, ttlMs: 0 }
        ]
      })
    })

    render(<StorageTab />)
    fireEvent.click(screen.getByText('deep_clean'))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('deep_clean_confirm_title')
    // The names come from the same partition rows the tab renders.
    expect(dialog).toHaveTextContent('Chatgpt')
    expect(dialog).toHaveTextContent('Gemini')
    expect(deepCleanCache).not.toHaveBeenCalled()
  })
})
