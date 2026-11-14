import ExtensionPairingDialog from '@features/settings/ui/siteSessions/components/ExtensionPairingDialog'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CODE = 'a'.repeat(64)
const copy = vi.fn()
const install = vi.hoisted(() => vi.fn())

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingPairingCodeQuery: () => ({ data: CODE, isLoading: false }),
  useNativeMessagingStatusQuery: () => ({ data: { status: 'connected', paired: false } }),
  useInstallExtensionMutation: () => ({ mutateAsync: install, isPending: false })
}))

vi.mock('@shared/hooks/useClipboard', () => ({
  useClipboard: () => ({ copy, isCopied: false })
}))

vi.mock('@shared/hooks', () => ({
  useDialogBehavior: () => undefined
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => ({ openExternal: vi.fn() })
}))

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => {
      void initial
      void animate
      void exit
      void transition
      return <div {...props}>{children}</div>
    }
  }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('ExtensionPairingDialog', () => {
  beforeEach(() => {
    copy.mockReset()
    install.mockReset()
    install.mockResolvedValue({ path: '/data/ext', version: '1.4.0', refreshed: true })
  })

  it('shows the pairing code and copies it', () => {
    render(<ExtensionPairingDialog open onClose={vi.fn()} />)

    expect(screen.getByText(CODE)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_pairing_copy_btn' }))
    expect(copy).toHaveBeenCalledWith(CODE)
  })

  it('tells the user that a visible but unpaired extension is not ready', () => {
    render(<ExtensionPairingDialog open onClose={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('ws_extension_pairing_status_unpaired')
  })

  it('prepares the bundled extension and copies its folder path', async () => {
    render(<ExtensionPairingDialog open onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_install_btn' }))

    await waitFor(() => expect(install).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(copy).toHaveBeenCalledWith('/data/ext'))
    expect(screen.getByText('/data/ext')).toBeInTheDocument()
    expect(screen.getByText(/ws_extension_install_ready/)).toBeInTheDocument()
    // Files ready is not the same as connected: the extension is loaded but
    // still unpaired, and the new files may need a Chrome reload.
    expect(screen.getByText('ws_extension_install_status_unpaired')).toBeInTheDocument()
    expect(screen.getByText('ws_extension_install_reload_hint')).toBeInTheDocument()
  })
})
