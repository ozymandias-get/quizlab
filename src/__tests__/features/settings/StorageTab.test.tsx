/**
 * Render coverage for the Storage settings tab.
 *
 * The tab is a controller over four section components and one pure
 * view-model, so these tests pin the wiring the user actually sees: which
 * sections appear for a given cache-info payload, and which mutation each
 * control fires.
 */
import StorageTab from '@features/settings/ui/StorageTab'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('renders the meter and the root cache rows once data arrives', () => {
    setCacheInfo()

    render(<StorageTab />)

    expect(screen.getByText('total_cache')).toBeInTheDocument()
    expect(screen.getByText('root_caches')).toBeInTheDocument()
    // tempFiles is non-zero here, so the optional row is shown.
    expect(screen.getByText('temp_files')).toBeInTheDocument()
    expect(screen.getByText('clear_cache_title')).toBeInTheDocument()
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

  it('prefers the scheduler classification and hides a "none" recommendation button', () => {
    setCacheInfo({ smart: makeSmart({}, { action: 'none' }) })

    render(<StorageTab />)

    expect(screen.getByText(/^cache_pressure_warning · 80%$/)).toBeInTheDocument()
    expect(screen.queryByText('smart_clean_cold')).not.toBeInTheDocument()
  })

  it('maps a recommendation to the right smart-cache action and label', () => {
    setCacheInfo({ smart: makeSmart() })
    const { unmount } = render(<StorageTab />)

    fireEvent.click(screen.getByText('smart_clean_cold'))
    expect(smartCacheAction).toHaveBeenCalledWith('clean_cold')
    unmount()

    smartCacheAction.mockClear()
    setCacheInfo({ smart: makeSmart({}, { action: 'deep_clean' }) })
    render(<StorageTab />)

    // `deep_clean` labels both the plain deep-clean button and the smart-clean
    // button, in that DOM order; the smart one is the follow-up control.
    fireEvent.click(screen.getAllByText('deep_clean').at(-1) as HTMLElement)
    expect(smartCacheAction).toHaveBeenCalledWith('clean_all')
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
          { key: 'ai_chatgpt', size: 50, category: 'active', lastActive: 1, ttlMs: 0 }
        ]
      })
    })

    render(<StorageTab />)

    fireEvent.click(screen.getByLabelText('partition_clear_aria:{"name":"Chatgpt"}'))
    expect(clearPartitionCache).toHaveBeenCalledWith({ partition: 'persist:ai_chatgpt' })
  })

  it('fires the plain clear, deep clean and refresh mutations', () => {
    setCacheInfo()

    render(<StorageTab />)

    fireEvent.click(screen.getByText('clear_cache'))
    expect(clearCache).toHaveBeenCalled()

    fireEvent.click(screen.getByText('deep_clean'))
    expect(deepCleanCache).toHaveBeenCalled()

    fireEvent.click(screen.getByText('refresh'))
    expect(refetchCache).toHaveBeenCalled()
  })
})
