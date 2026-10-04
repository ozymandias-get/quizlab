import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Lifecycle contract for the Google Drive managed view.
 *
 * `GoogleDrivePanel` is mounted twice (workspace and focus overlay) under a
 * single view id, and it also unmounts when the user simply switches to another
 * pdf tab. Unmount therefore cannot mean "destroy": the view has to survive a
 * focus-mode swap and a tab switch, and only the pdf tab actually closing may
 * retire it.
 */

const aiViewClient = vi.hoisted(() => ({ destroy: vi.fn() }))
const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))
vi.mock('@shared/lib/logger', () => ({ reportSuppressedError: vi.fn() }))

const pdfTabState = vi.hoisted(() => ({
  pdfTabs: [] as Array<{ id: string; kind?: 'pdf' | 'drive' }>
}))

vi.mock('@features/pdf/store/usePdfTabStore', () => ({
  usePdfTabStore: (selector: (state: typeof pdfTabState) => unknown) => selector(pdfTabState)
}))

const { useDriveViewRetirement } = await import('@features/pdf/hooks/useDriveViewRetirement')

const destroyedIds = () => aiViewClient.destroy.mock.calls.map(([request]) => request.viewId)

const driveTab = (id: string) => ({ id, kind: 'drive' as const })
const pdfTab = (id: string) => ({ id, kind: 'pdf' as const })

function mount() {
  return renderHook(() => useDriveViewRetirement())
}

describe('useDriveViewRetirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.destroy.mockResolvedValue(true)
    pdfTabState.pdfTabs = [driveTab('a')]
  })

  it('retires nothing while the drive tab stays open', () => {
    const { rerender } = mount()
    rerender()
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('does not retire the view when another pdf tab takes over the surface', () => {
    // The panel unmounts here, but the drive tab is still in the list: coming
    // back to it must not reload Drive.
    const { rerender } = mount()
    act(() => {
      pdfTabState.pdfTabs = [driveTab('a'), pdfTab('b')]
      rerender()
    })
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('retires the view when the drive tab is closed', () => {
    const { rerender } = mount()
    act(() => {
      pdfTabState.pdfTabs = []
      rerender()
    })
    expect(destroyedIds()).toEqual(['gdrive:a'])
  })

  it('keeps a drive tab alive across a focus-mode style remount', () => {
    // Workspace host unmounts, focus-overlay host mounts: same view id, no
    // retirement, no reload.
    const { unmount, rerender } = mount()
    act(() => {
      pdfTabState.pdfTabs = [driveTab('a'), driveTab('b')]
      rerender()
    })
    unmount()
    renderHook(() => useDriveViewRetirement())

    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('retires only the drive tabs that went away', () => {
    const { rerender } = mount()
    act(() => {
      pdfTabState.pdfTabs = [driveTab('a'), driveTab('b'), pdfTab('c')]
      rerender()
    })
    act(() => {
      pdfTabState.pdfTabs = [driveTab('b'), pdfTab('c')]
      rerender()
    })
    expect(destroyedIds()).toEqual(['gdrive:a'])
  })
})
