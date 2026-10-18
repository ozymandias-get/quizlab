import { useSettings } from '@features/settings/hooks/useSettings'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckForUpdates = vi.fn()
const mockUseUpdate = vi.fn()
vi.mock('@app/providers/UpdateContext', () => ({
  useUpdate: () => mockUseUpdate(),
  UpdateProvider: ({ children }: any) => <>{children}</>
}))

const mockUseAppVersion = vi.fn()
const mockOpenExternal = vi.fn()
vi.mock('@platform/electron/api/useSettingsSystemApi', () => ({
  useAppVersion: () => mockUseAppVersion(),
  useOpenExternal: () => ({ mutate: mockOpenExternal })
}))

const RELEASES_URL = 'https://github.com/ozymandias-get/quizlab/releases/latest'

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAppVersion.mockReturnValue({ data: '1.2.3' })
    mockUseUpdate.mockReturnValue({
      updateAvailable: false,
      updateInfo: null,
      isCheckingUpdate: false,
      hasCheckedUpdate: false,
      checkForUpdates: mockCheckForUpdates
    })
  })

  it.each([
    ['a reported version', '1.2.3', '1.2.3'],
    ['an unavailable version', undefined, '1.0.0']
  ])('reports %s as %s', (_label, data, expected) => {
    mockUseAppVersion.mockReturnValue({ data })

    const { result } = renderHook(() => useSettings())

    expect(result.current.appVersion).toBe(expected)
  })

  // One precedence chain in useSettings.ts: checking → error → available →
  // latest → idle. Getting the order wrong shows the wrong button in the About
  // tab, so each rung is pinned individually.
  it.each([
    ['checking', { isCheckingUpdate: true, hasCheckedUpdate: false }],
    ['error', { updateInfo: { error: 'Network Error' }, isCheckingUpdate: false }],
    [
      'available',
      { updateAvailable: true, updateInfo: { version: '2.0.0' }, isCheckingUpdate: false }
    ],
    ['latest', { updateAvailable: false, hasCheckedUpdate: true, isCheckingUpdate: false }],
    ['idle', { updateAvailable: false, hasCheckedUpdate: false, isCheckingUpdate: false }]
  ])('derives updateStatus %s from the update context', (expected, updateContext) => {
    mockUseUpdate.mockReturnValue({
      updateInfo: null,
      checkForUpdates: mockCheckForUpdates,
      ...updateContext
    })

    const { result } = renderHook(() => useSettings())

    expect(result.current.updateStatus).toBe(expected)
  })

  it('forwards the update info alongside the available status', () => {
    mockUseUpdate.mockReturnValue({
      updateAvailable: true,
      updateInfo: { version: '2.0.0' },
      isCheckingUpdate: false,
      hasCheckedUpdate: false,
      checkForUpdates: mockCheckForUpdates
    })

    const { result } = renderHook(() => useSettings())

    expect(result.current.updateInfo).toEqual({ version: '2.0.0' })
  })

  it('delegates checkForUpdates to the update context', async () => {
    const { result } = renderHook(() => useSettings())

    await act(async () => {
      await result.current.checkForUpdates()
    })

    expect(mockCheckForUpdates).toHaveBeenCalledTimes(1)
  })

  it('opens the releases page through the OS, not the renderer', async () => {
    const { result } = renderHook(() => useSettings())

    await act(async () => {
      await result.current.openReleasesPage()
    })

    expect(mockOpenExternal).toHaveBeenCalledWith(RELEASES_URL)
  })
})
