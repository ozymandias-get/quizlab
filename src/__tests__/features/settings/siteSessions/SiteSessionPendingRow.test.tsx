import type { SiteSessionAccountView } from '@shared-core/types/siteSession'

import SiteSessionPendingRow from '@features/settings/ui/siteSessions/SiteSessionPendingRow'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
const t = (key: string, params?: Record<string, string>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key

/** Renders the pending row of a site and hands the calls back to the test. */
function renderRow(accounts: SiteSessionAccountView[] = [PRIMARY_ACCOUNT, SECOND_ACCOUNT]) {
  const onResolve = vi.fn()

  render(
    <SiteSessionPendingRow
      siteId="google"
      accounts={accounts}
      disabled={false}
      onResolve={onResolve}
      t={t}
    />
  )

  return { onResolve }
}

describe('SiteSessionPendingRow', () => {
  it('asks which account the session belongs to', () => {
    renderRow()

    expect(screen.getByTestId('site-session-pending-row')).toBeInTheDocument()
    expect(screen.getByText('ws_pending_title')).toBeInTheDocument()
    expect(screen.getByText('ws_pending_question', { selector: 'p' })).toBeInTheDocument()
  })

  it('offers the accounts of the site and a new one', () => {
    renderRow()

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toContain('Kisisel')
    expect(options).toContain('ws_account_default 1')
    expect(options).toContain('ws_pending_new_account')
  })

  it('waits for the user to pick an account', () => {
    renderRow()

    expect(screen.getByRole('button', { name: 'ws_pending_resolve' })).toBeDisabled()
  })

  it('writes the session into the account the user picked', () => {
    const { onResolve } = renderRow()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a1' } })
    fireEvent.click(screen.getByRole('button', { name: 'ws_pending_resolve' }))

    expect(onResolve).toHaveBeenCalledWith('google', 'a1')
  })

  it('writes the session into a new account when the user asks for one', () => {
    const { onResolve } = renderRow()

    const newAccount = screen.getByRole('option', { name: 'ws_pending_new_account' })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: (newAccount as HTMLOptionElement).value }
    })
    fireEvent.click(screen.getByRole('button', { name: 'ws_pending_resolve' }))

    expect(onResolve).toHaveBeenCalledWith('google', null)
  })
})
