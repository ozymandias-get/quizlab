import ExtensionStatusCard from '@features/settings/ui/siteSessions/components/ExtensionStatusCard'

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  info: { status: 'error', paired: true } as {
    status: string
    paired: boolean
    userHint?: string
  }
}))

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({ data: state.info })
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => null
}))

describe('ExtensionStatusCard', () => {
  beforeEach(() => {
    state.info = { status: 'error', paired: true }
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
})
