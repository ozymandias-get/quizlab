import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useSettings } from '@features/settings/hooks/useSettings'

const mockCheckForUpdates = vi.fn()
const mockUseUpdate = vi.fn()
vi.mock('@app/providers/UpdateContext', () => ({
  useUpdate: () => mockUseUpdate(),
  UpdateProvider: ({ children }: any) => <>{children}</>
}))

const mockUseAppVersion = vi.fn()
vi.mock('@platform/electron/api/useSystemApi', () => ({
  useAppVersion: () => mockUseAppVersion(),
  useOpenExternal: () => ({ mutate: mockOpenExternal })
}))

const mockOpenExternal = vi.fn()

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

  it('should return app version', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.appVersion).toBe('1.2.3')
  })

  it('should return "checking" when checking for updates', () => {
    mockUseUpdate.mockReturnValue({
      isCheckingUpdate: true,
      hasCheckedUpdate: false,
      checkForUpdates: mockCheckForUpdates
    })

    const { result } = renderHook(() => useSettings())
    expect(result.current.updateStatus).toBe('checking')
  })

  it('should return "error" when update info has error', () => {
    mockUseUpdate.mockReturnValue({
      updateInfo: { error: 'Network Error' },
      isCheckingUpdate: false,
      checkForUpdates: mockCheckForUpdates
    })

    const { result } = renderHook(() => useSettings())
    expect(result.current.updateStatus).toBe('error')
  })

  it('should return "available" when update is available', () => {
    mockUseUpdate.mockReturnValue({
      updateAvailable: true,
      updateInfo: { version: '2.0.0' },
      isCheckingUpdate: false,
      checkForUpdates: mockCheckForUpdates
    })

    const { result } = renderHook(() => useSettings())
    expect(result.current.updateStatus).toBe('available')
    expect(result.current.updateInfo).toEqual({ version: '2.0.0' })
  })

  it('should return "latest" when checked and no update', () => {
    mockUseUpdate.mockReturnValue({
      updateAvailable: false,
      hasCheckedUpdate: true,
      isCheckingUpdate: false,
      checkForUpdates: mockCheckForUpdates
    })

    const { result } = renderHook(() => useSettings())
    expect(result.current.updateStatus).toBe('latest')
  })

  it('should return "idle" initially', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.updateStatus).toBe('idle')
  })

  it('calls checkForUpdates from context', async () => {
    const { result } = renderHook(() => useSettings())

    await act(async () => {
      await result.current.checkForUpdates()
    })

    expect(mockCheckForUpdates).toHaveBeenCalled()
  })

  it('calls openExternal with releases URL', async () => {
    const { result } = renderHook(() => useSettings())

    await act(async () => {
      await result.current.openReleasesPage()
    })

    expect(mockOpenExternal).toHaveBeenCalledWith(
      'https://github.com/ozymandias-get/quizlab/releases/latest'
    )
  })

  it('handles default app version if undefined', () => {
    mockUseAppVersion.mockReturnValue({ data: undefined })

    const { result } = renderHook(() => useSettings())
    expect(result.current.appVersion).toBe('1.0.0')
  })
})
