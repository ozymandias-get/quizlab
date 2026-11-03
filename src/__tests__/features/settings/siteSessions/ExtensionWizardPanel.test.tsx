import ExtensionWizardPanel from '@features/settings/ui/siteSessions/components/ExtensionWizardPanel'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function renderWizard(
  onInstall: () => Promise<{ success: boolean; error?: string } | null>,
  installedPath: string | null = null
) {
  const view = render(
    <ExtensionWizardPanel
      open
      mode="install"
      riskItems={['risk one']}
      mitigationItems={['mitigation one']}
      installedPath={installedPath}
      onInstall={onInstall}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />
  )

  const rerenderWizard = (next: { open?: boolean; installedPath?: string | null }) =>
    view.rerender(
      <ExtensionWizardPanel
        open={next.open ?? true}
        mode="install"
        riskItems={['risk one']}
        mitigationItems={['mitigation one']}
        installedPath={next.installedPath ?? installedPath}
        onInstall={onInstall}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />
    )

  return { ...view, rerenderWizard }
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

  it('starts only one retry when the button receives two clicks in one tick', async () => {
    let resolveRetry: (value: { success: boolean } | null) => void = () => undefined
    const onInstall = vi
      .fn<() => Promise<{ success: boolean; error?: string } | null>>()
      .mockResolvedValueOnce({ success: false, error: 'install_failed' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve
          })
      )

    renderWizard(onInstall)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_next_btn' }))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_install_btn' }))

    const retry = await screen.findByRole('button', {
      name: 'ws_extension_wizard_retry_btn'
    })

    act(() => {
      retry.click()
      retry.click()
    })

    expect(onInstall).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveRetry({ success: true })
    })
  })

  it('does not reset the open wizard when the installed path updates', async () => {
    const onInstall = vi.fn<() => Promise<{ success: boolean } | null>>()
    const { rerenderWizard } = renderWizard(onInstall)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_next_btn' }))
    expect(
      screen.getByRole('button', { name: 'ws_extension_wizard_install_btn' })
    ).toBeInTheDocument()

    rerenderWizard({ installedPath: 'C:/extensions/quizlab' })

    // A late path update must not send the user back to the risk step.
    expect(
      screen.getByRole('button', { name: 'ws_extension_wizard_install_btn' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('ignores a result that belongs to a previous wizard session', async () => {
    let resolveInstall: (value: { success: boolean } | null) => void = () => undefined
    const onInstall = vi.fn(
      () =>
        new Promise<{ success: boolean } | null>((resolve) => {
          resolveInstall = resolve
        })
    )
    const { rerenderWizard } = renderWizard(onInstall)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_next_btn' }))
    fireEvent.click(screen.getByRole('button', { name: 'ws_extension_wizard_install_btn' }))

    expect(await screen.findByText('ws_extension_wizard_loading_blocked')).toBeInTheDocument()

    // Close and reopen while the old install is still pending.
    rerenderWizard({ open: false })
    rerenderWizard({ open: true })

    await act(async () => {
      resolveInstall({ success: true })
    })

    // The old success must not drive the fresh session's screen.
    expect(screen.queryByText('ws_extension_wizard_manual_title')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
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
