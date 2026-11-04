import GoogleDrivePanel from '@features/pdf/ui/components/GoogleDrivePanel'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useManagedContentView = vi.hoisted(() => vi.fn())
const useIsAnyDialogOpen = vi.hoisted(() => vi.fn(() => false))
const useSiteSessionListQuery = vi.hoisted(() =>
  vi.fn(() => ({ data: undefined as { views: Array<Record<string, unknown>> } | undefined }))
)
const setPdfTabSessionSlot = vi.hoisted(() => vi.fn())

vi.mock('@shared/hooks/aiContent/useManagedContentView', () => ({ useManagedContentView }))
vi.mock('@shared/hooks', () => ({ useIsAnyDialogOpen }))
vi.mock('@platform/electron/api/useSiteSessionApi', () => ({ useSiteSessionListQuery }))
vi.mock('@features/pdf/store/usePdfTabStore', () => ({
  usePdfTabStore: (
    selector: (state: { setPdfTabSessionSlot: typeof setPdfTabSessionSlot }) => unknown
  ) => selector({ setPdfTabSessionSlot })
}))

const baseProps = {
  tabId: 'pdf-1',
  webviewUrl: 'https://drive.google.com/drive/my-drive',
  title: 'Google Drive',
  description: 'Pick a file',
  reloadLabel: 'Reload',
  isInteractionBlocked: false
}

describe('GoogleDrivePanel', () => {
  beforeEach(() => {
    useManagedContentView.mockReset()
    useManagedContentView.mockReturnValue({ setHostElement: vi.fn(), reload: vi.fn() })
    useIsAnyDialogOpen.mockReturnValue(false)
    useSiteSessionListQuery.mockReturnValue({ data: undefined })
  })

  const lastOptions = () => useManagedContentView.mock.calls.at(-1)?.[0]

  it('hosts the managed view on a namespaced id with the google target', () => {
    render(<GoogleDrivePanel {...baseProps} />)

    expect(lastOptions()).toMatchObject({
      viewId: 'gdrive:pdf-1',
      source: { kind: 'google-web-app', appId: 'gdrive' }
    })
    expect(screen.getByTestId('drive-host')).toBeInTheDocument()
  })

  it('stays visible while the dock is hovered', () => {
    // Regression guard: visibility used to follow `isInteractionBlocked`, which
    // also means "the resizer dock is hovered" — so crossing the divider blanked
    // the whole panel. The dock never overlaps this panel, so nothing has to
    // give way for it.
    render(<GoogleDrivePanel {...baseProps} isInteractionBlocked />)
    expect(lastOptions().visible).toBe(true)
  })

  it('steps aside while a dialog is open', () => {
    // A native view paints above the DOM, so a modal has to be able to hide it.
    useIsAnyDialogOpen.mockReturnValue(true)
    render(<GoogleDrivePanel {...baseProps} />)
    expect(lastOptions().visible).toBe(false)
  })

  it('passes the active Google account slot and clamps to discovered accounts', () => {
    useSiteSessionListQuery.mockReturnValue({
      data: {
        views: [{ siteId: 'google', kind: 'google', activeSlot: 3, accountSlots: [1, 2] }]
      }
    })
    render(<GoogleDrivePanel {...baseProps} />)
    expect(lastOptions().source).toEqual({
      kind: 'google-web-app',
      appId: 'gdrive',
      sessionSlot: 1
    })
  })

  it('keeps the slot stored on the PDF tab instead of following the global choice', () => {
    useSiteSessionListQuery.mockReturnValue({
      data: {
        views: [{ siteId: 'google', kind: 'google', activeSlot: 1, accountSlots: [1, 2] }]
      }
    })
    render(<GoogleDrivePanel {...baseProps} sessionSlot={2} />)
    expect(lastOptions().source).toEqual({
      kind: 'google-web-app',
      appId: 'gdrive',
      sessionSlot: 2
    })
  })

  it('offers a per-tab account switch once more than one account is discovered', () => {
    useSiteSessionListQuery.mockReturnValue({
      data: {
        views: [{ siteId: 'google', kind: 'google', activeSlot: 1, accountSlots: [1, 2] }]
      }
    })
    render(<GoogleDrivePanel {...baseProps} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '2' } })
    expect(setPdfTabSessionSlot).toHaveBeenCalledWith('pdf-1', 2)
  })

  it('hides the account switch while a single account is discovered', () => {
    useSiteSessionListQuery.mockReturnValue({
      data: {
        views: [{ siteId: 'google', kind: 'google', activeSlot: 1, accountSlots: [1] }]
      }
    })
    render(<GoogleDrivePanel {...baseProps} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
