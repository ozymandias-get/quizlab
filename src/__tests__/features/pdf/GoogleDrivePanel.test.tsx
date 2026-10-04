import GoogleDrivePanel from '@features/pdf/ui/components/GoogleDrivePanel'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useManagedContentView = vi.hoisted(() => vi.fn())
const useIsAnyDialogOpen = vi.hoisted(() => vi.fn(() => false))

vi.mock('@shared/hooks/aiContent/useManagedContentView', () => ({ useManagedContentView }))
vi.mock('@shared/hooks', () => ({ useIsAnyDialogOpen }))

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
})
