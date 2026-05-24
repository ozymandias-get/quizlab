import { render, renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UpdateProvider, useUpdate } from '@app/providers/UpdateContext'
import { useCheckForUpdates } from '@platform/electron/api/useSystemApi'

vi.mock('@platform/electron/api/useSystemApi', () => ({
  useCheckForUpdates: vi.fn()
}))

describe('UpdateContext', () => {
  let mockRefetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockRefetch = vi.fn()
    vi.mocked(useCheckForUpdates).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetched: false,
      refetch: mockRefetch
    } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should throw an error when useUpdate is used outside of UpdateProvider', () => {
    // Suppress console.error output for expected error boundary test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useUpdate())
    }).toThrow('useUpdate must be used within UpdateProvider')

    consoleError.mockRestore()
  })

  it('should start with isEnabled as false, then set to true after 5000ms delay', () => {
    const TestComponent = () => {
      const { isCheckingUpdate } = useUpdate()
      return <div data-testid="checking">{String(isCheckingUpdate)}</div>
    }

    vi.mocked(useCheckForUpdates).mockImplementation(
      (_enabled) =>
        ({
          data: undefined,
          isLoading: true,
          isFetched: false,
          refetch: mockRefetch
        }) as any
    )

    render(
      <UpdateProvider>
        <TestComponent />
      </UpdateProvider>
    )

    // Initially isEnabled is false, so useCheckForUpdates should have been called with false
    expect(useCheckForUpdates).toHaveBeenLastCalledWith(false)

    // Advance by 5000ms delay
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Now it should be called with true
    expect(useCheckForUpdates).toHaveBeenLastCalledWith(true)
  })

  it('should provide update states correctly', () => {
    vi.mocked(useCheckForUpdates).mockReturnValue({
      data: { available: true, version: '1.2.3' },
      isLoading: false,
      isFetched: true,
      refetch: mockRefetch
    } as any)

    const TestComponent = () => {
      const { updateAvailable, updateInfo, hasCheckedUpdate } = useUpdate()
      return (
        <div>
          <div data-testid="available">{String(updateAvailable)}</div>
          <div data-testid="version">{updateInfo?.version}</div>
          <div data-testid="fetched">{String(hasCheckedUpdate)}</div>
        </div>
      )
    }

    const { getByTestId } = render(
      <UpdateProvider>
        <TestComponent />
      </UpdateProvider>
    )

    expect(getByTestId('available').textContent).toBe('true')
    expect(getByTestId('version').textContent).toBe('1.2.3')
    expect(getByTestId('fetched').textContent).toBe('true')
  })

  it('should trigger manual updates search when checkForUpdates is called', async () => {
    mockRefetch.mockResolvedValue({
      data: { available: true, version: '2.0.0' }
    })

    const TestComponent = () => {
      const { checkForUpdates } = useUpdate()
      return (
        <button
          data-testid="btn"
          onClick={async () => {
            const res = await checkForUpdates()
            const container = document.createElement('div')
            container.id = 'result'
            container.textContent = `${res.available}-${res.version}`
            document.body.appendChild(container)
          }}
        />
      )
    }

    const { getByTestId } = render(
      <UpdateProvider>
        <TestComponent />
      </UpdateProvider>
    )

    const btn = getByTestId('btn')
    await act(async () => {
      btn.click()
    })

    expect(mockRefetch).toHaveBeenCalled()
    const resDiv = document.getElementById('result')
    expect(resDiv?.textContent).toBe('true-2.0.0')

    resDiv?.remove()
  })
})
