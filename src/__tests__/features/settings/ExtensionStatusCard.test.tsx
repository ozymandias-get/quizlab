import ExtensionStatusCard from '@features/settings/ui/siteSessions/components/ExtensionStatusCard'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  info: { status: 'error', paired: true } as {
    status: string
    paired: boolean
    userHint?: string
    environment?: string
  },
  install: vi.fn(),
  copy: vi.fn()
}))

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({ data: state.info }),
  useInstallExtensionMutation: () => ({ mutateAsync: state.install, isPending: false })
}))

vi.mock('@shared/hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: state.copy, isCopied: false })
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => null
}))

describe('ExtensionStatusCard', () => {
  beforeEach(() => {
    state.info = { status: 'error', paired: true }
    state.install.mockReset()
    state.copy.mockReset()
    state.install.mockResolvedValue({
      path: '/home/user/.config/quizlab/extension/quizlab-session-extension',
      version: '1.4.0',
      refreshed: true
    })
    state.copy.mockResolvedValue(true)
  })

  it('uses the error colour for a connection error instead of the idle grey', () => {
    const { container, getByText } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    expect(getByText('ws_extension_status_error')).toBeInTheDocument()
    expect(container.querySelector('.bg-destructive')).toBeInTheDocument()
  })

  it('announces connection status changes through a polite live region', () => {
    const { getByRole } = render(<ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />)

    const status = getByRole('status')
    expect(status).toHaveTextContent('ws_extension_status_error')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
  })

  it('shows an origin-only request as unpaired, never as a ready connection', () => {
    // The bridge marks a profile seen after the origin check. That is enough
    // to show activity, but only a signed request may look like a ready
    // connection.
    state.info = { status: 'connected', paired: false }

    const { container, getByText } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    expect(getByText('ws_extension_status_unpaired')).toBeInTheDocument()
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument()
    expect(container.querySelector('.bg-emerald-500')).not.toBeInTheDocument()
  })

  it('shows a signed and paired extension as connected', () => {
    state.info = { status: 'connected', paired: true }

    const { container, getByText } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    expect(getByText('ws_extension_status_connected')).toBeInTheDocument()
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument()
  })

  it('shows a seen profile without a selected source as waiting', () => {
    state.info = { status: 'connecting', paired: false, userHint: 'waiting' }

    const { container, getByText } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    expect(getByText('ws_extension_status_waiting')).toBeInTheDocument()
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument()
  })

  it('names the development build in a development app', () => {
    state.info = { status: 'disconnected', paired: false, environment: 'dev' }

    const { getByText } = render(<ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />)

    expect(getByText('ws_extension_dev_build_notice')).toBeInTheDocument()
  })

  it('shows no development notice in the release app', () => {
    state.info = { status: 'disconnected', paired: false, environment: 'prod' }

    const { queryByText } = render(<ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />)

    expect(queryByText('ws_extension_dev_build_notice')).not.toBeInTheDocument()
  })

  it('prepares the bundled extension and copies its folder', async () => {
    const { getByRole, findByText } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    fireEvent.click(getByRole('button', { name: /ws_extension_install_btn/ }))

    await waitFor(() => expect(state.install).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(state.copy).toHaveBeenCalledWith(
        '/home/user/.config/quizlab/extension/quizlab-session-extension'
      )
    )
    expect(
      await findByText('/home/user/.config/quizlab/extension/quizlab-session-extension')
    ).toBeInTheDocument()
    expect(await findByText(/ws_extension_install_ready/)).toBeInTheDocument()
    expect(await findByText('ws_extension_install_hint')).toBeInTheDocument()
  })

  it('does not call a prepared folder a connected extension', async () => {
    state.info = { status: 'disconnected', paired: false }
    const { getByRole, findByText, container } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    fireEvent.click(getByRole('button', { name: /ws_extension_install_btn/ }))

    expect(await findByText(/ws_extension_install_ready/)).toBeInTheDocument()
    expect(await findByText('ws_extension_install_status_load')).toBeInTheDocument()
    expect(container.querySelector('.border-amber-500\\/25')).toBeInTheDocument()
    expect(container.querySelector('.border-emerald-500\\/20')).not.toBeInTheDocument()
    expect(screen.queryByText('ws_extension_install_reload_hint')).not.toBeInTheDocument()
  })

  it('asks for a Chrome reload after replacing files of a loaded extension', async () => {
    state.info = { status: 'connected', paired: false }
    const { getByRole, findByText } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    fireEvent.click(getByRole('button', { name: /ws_extension_install_btn/ }))

    expect(await findByText('ws_extension_install_status_unpaired')).toBeInTheDocument()
    expect(await findByText('ws_extension_install_reload_hint')).toBeInTheDocument()
  })

  it('reports a folder that could not be prepared', async () => {
    state.install.mockRejectedValue(new Error('missing bundle'))

    const { getByRole, findByRole } = render(
      <ExtensionStatusCard t={(key) => key} onShowPairing={vi.fn()} />
    )

    fireEvent.click(getByRole('button', { name: /ws_extension_install_btn/ }))

    expect(await findByRole('alert')).toHaveTextContent('ws_extension_install_error')
    expect(state.copy).not.toHaveBeenCalled()
  })
})
