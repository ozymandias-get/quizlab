import type { SiteSessionAccountView } from '@shared-core/types/siteSession'

import SiteSessionAccountRow from '@features/settings/ui/siteSessions/SiteSessionAccountRow'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const PRIMARY_ACCOUNT: SiteSessionAccountView = {
  accountId: 'primary',
  name: null,
  index: 1,
  enabled: false,
  status: 'signed_out',
  importedAt: null,
  lastError: null,
  isActive: false,
  isPrimary: true
}

const SECOND_ACCOUNT: SiteSessionAccountView = {
  accountId: 'a1',
  name: 'Kisisel',
  index: 2,
  enabled: true,
  status: 'imported',
  importedAt: '2026-04-08T10:00:00.000Z',
  lastError: null,
  isActive: true,
  isPrimary: false
}

/** The row asks for a translation; the test shows the key and its values. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key

const noop = () => {}

/** Renders one account row and hands the calls it made back to the test. */
function renderRow(overrides: Partial<SiteSessionAccountView> = {}) {
  const onToggle = vi.fn()
  const onSetActive = vi.fn()
  const onRename = vi.fn()
  const onDelete = vi.fn()

  render(
    <SiteSessionAccountRow
      siteId="google"
      siteLabel="Google"
      account={{ ...SECOND_ACCOUNT, ...overrides }}
      disabled={false}
      actions={{
        onToggle,
        onSetActive,
        onRename,
        onDelete,
        onResolvePending: noop,
        onReAskAttribution: noop
      }}
      t={t}
    />
  )

  return { onToggle, onSetActive, onRename, onDelete }
}

describe('SiteSessionAccountRow', () => {
  it('shows the name the user gave the account', () => {
    renderRow()
    expect(screen.getByText('Kisisel')).toBeInTheDocument()
  })

  it('offers a name for an account that has none', () => {
    renderRow({ name: null, index: 2 })

    // The name is derived from the place of the account in the site.
    expect(screen.getByText('ws_account_default 2')).toBeInTheDocument()
    expect(screen.getByText('ws_account_unnamed_hint')).toBeInTheDocument()
  })

  it('shows the state of the account', () => {
    renderRow({ status: 'signed_out' })
    expect(screen.getByText('ws_status_signed_out')).toBeInTheDocument()
  })

  it('shows when the session was pulled the last time', () => {
    renderRow({ status: 'imported', importedAt: '2026-04-08T10:00:00.000Z' })
    expect(screen.getByText(/ws_last_pull/)).toBeInTheDocument()
  })

  it('shows why the last import failed', () => {
    renderRow({ status: 'import_failed', lastError: 'write_failed' })
    expect(screen.getByText('ws_error_write_failed')).toBeInTheDocument()
  })

  it('marks the account the panels open with', () => {
    renderRow({ isActive: true })
    expect(screen.getByText('ws_account_active')).toBeInTheDocument()
  })

  it('offers to make another account the one the panels open with', () => {
    const { onSetActive } = renderRow({ isActive: false })

    fireEvent.click(screen.getByRole('button', { name: 'ws_account_set_active' }))

    expect(onSetActive).toHaveBeenCalledWith('google', 'a1')
  })

  it('turns the switch of the account off', () => {
    const { onToggle } = renderRow({ enabled: true })

    fireEvent.click(screen.getByRole('switch'))

    expect(onToggle).toHaveBeenCalledWith('google', 'a1')
  })

  it('names the switch after the account and the site it belongs to', () => {
    renderRow()

    const name = screen.getByRole('switch').getAttribute('aria-label') ?? ''
    expect(name).toContain('ws_toggle_label')
    expect(name).toContain('Kisisel')
    expect(name).toContain('Google')
  })

  it('does not offer to delete the primary account', () => {
    renderRow({ ...PRIMARY_ACCOUNT })

    expect(screen.queryByTestId('site-session-delete-primary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('site-session-delete-account')).not.toBeInTheDocument()
  })

  it('asks before it removes an additional account', async () => {
    const { onDelete } = renderRow({ isPrimary: false })

    fireEvent.click(screen.getByTestId('site-session-delete-account'))

    expect(await screen.findByText('ws_account_delete_confirm')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('removes an additional account the user confirmed', async () => {
    const { onDelete } = renderRow({ isPrimary: false })

    fireEvent.click(screen.getByTestId('site-session-delete-account'))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('google', 'a1'))
  })

  it('keeps the account when the user does not confirm', async () => {
    const { onDelete } = renderRow({ isPrimary: false })

    fireEvent.click(screen.getByTestId('site-session-delete-account'))
    fireEvent.click(await screen.findByRole('button', { name: 'cancel' }))

    await waitFor(() => expect(onDelete).not.toHaveBeenCalled())
  })

  it('gives the account the name the user typed', () => {
    const { onRename } = renderRow()

    fireEvent.click(screen.getByText('Kisisel'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Is' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onRename).toHaveBeenCalledWith('google', 'a1', 'Is')
  })

  it('takes the name away when the field is emptied', () => {
    const { onRename } = renderRow()

    fireEvent.click(screen.getByText('Kisisel'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onRename).toHaveBeenCalledWith('google', 'a1', '')
  })

  it('keeps the name the account already has', () => {
    const { onRename } = renderRow()

    fireEvent.click(screen.getByText('Kisisel'))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onRename).not.toHaveBeenCalled()
  })
})
