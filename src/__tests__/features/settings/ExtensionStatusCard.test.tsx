import ExtensionStatusCard from '@features/settings/ui/siteSessions/components/ExtensionStatusCard'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({
    data: { status: 'error', installed: true }
  })
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => null
}))

describe('ExtensionStatusCard', () => {
  it('uses the error colour for a connection error instead of the idle grey', () => {
    const { container, getByText } = render(
      <ExtensionStatusCard
        t={(key) => key}
        onInstallExtension={vi.fn()}
        onRemoveExtension={vi.fn()}
      />
    )

    expect(getByText('ws_extension_status_error')).toBeInTheDocument()
    expect(container.querySelector('.bg-destructive')).toBeInTheDocument()
  })

  it('announces connection status changes through a polite live region', () => {
    const { getByRole } = render(
      <ExtensionStatusCard
        t={(key) => key}
        onInstallExtension={vi.fn()}
        onRemoveExtension={vi.fn()}
      />
    )

    const status = getByRole('status')
    expect(status).toHaveTextContent('ws_extension_status_error')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
  })
})
