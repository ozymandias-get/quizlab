import ExtensionWizardPanel from '@features/settings/ui/siteSessions/components/ExtensionWizardPanel'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({ data: { status: 'disconnected' } })
}))

vi.mock('@shared/hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn(), isCopied: false })
}))

vi.mock('@shared/hooks', () => ({
  useDialogBehavior: () => undefined
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

function renderWizard(onInstall: () => Promise<{ success: boolean; error?: string } | null>) {
  render(
    <ExtensionWizardPanel
      open
      mode="install"
      riskItems={['risk one']}
      mitigationItems={['mitigation one']}
      installedPath={null}
      onInstall={onInstall}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />
  )
}

describe('ExtensionWizardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers a retry on the error screen and clears the error on success', async () => {
    const onInstall = vi
      .fn<() => Promise<{ success: boolean; error?: string } | null>>()
      .mockResolvedValueOnce({ success: false, error: 'install_failed' })
      .mockResolvedValueOnce({ success: true })

    renderWizard(onInstall)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_next_btn' }))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_install_btn' }))

    expect(await screen.findByText('install_failed')).toBeInTheDocument()
    expect(screen.getByText('ws_extension_wizard_error_title')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_retry_btn' }))

    await waitFor(() => expect(onInstall).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByText('ws_extension_wizard_error_title')).not.toBeInTheDocument()
    )
  })

  it('explains why the wizard cannot be dismissed while the operation runs', async () => {
    const onInstall = vi.fn(() => new Promise<{ success: boolean } | null>(() => undefined))

    renderWizard(onInstall)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_next_btn' }))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_install_btn' }))

    expect(await screen.findByText('ws_extension_wizard_loading_blocked')).toBeInTheDocument()
  })
})
