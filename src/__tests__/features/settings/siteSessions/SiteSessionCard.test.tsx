import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import SiteSessionCard from '@features/settings/ui/siteSessions/SiteSessionCard'

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

const GOOGLE_VIEW: SiteSessionSiteView = {
  siteId: 'google',
  labelKey: 'ws_target_google',
  hostname: 'gemini.google.com',
  kind: 'google',
  memberAppIds: ['gemini', 'aistudio', 'youtube', 'gdrive'],
  accounts: [PRIMARY_ACCOUNT, SECOND_ACCOUNT],
  activeAccountId: 'a1',
  attributedAccountId: null,
  hasPendingSession: false
}

const CHATGPT_VIEW: SiteSessionSiteView = {
  siteId: 'chatgpt',
  labelKey: 'ws_target_chatgpt',
  hostname: 'chatgpt.com',
  kind: 'builtin',
  memberAppIds: ['chatgpt'],
  accounts: [PRIMARY_ACCOUNT],
  activeAccountId: null,
  attributedAccountId: null,
  hasPendingSession: false
}

/** The card asks for a translation; the test shows the key and its values. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key

/** Renders one card and hands the calls it made back to the test. */
function renderCard(view: SiteSessionSiteView = GOOGLE_VIEW) {
  const actions = {
    onToggle: vi.fn(),
    onSetActive: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onResolvePending: vi.fn(),
    onReAskAttribution: vi.fn()
  }

  render(<SiteSessionCard view={view} disabled={false} actions={actions} t={t} />)

  return actions
}

describe('SiteSessionCard', () => {
  it('shows one row per account of the site', () => {
    renderCard()
    expect(screen.getAllByTestId('site-session-account-row')).toHaveLength(2)
  })

  it('shows the name of the active account', () => {
    renderCard()
    expect(screen.getByText('Kisisel')).toBeInTheDocument()
  })

  it('offers a name for an account that has none', () => {
    renderCard()
    expect(screen.getByText(/ws_account_default/)).toBeInTheDocument()
  })

  it('does not offer to delete the primary account', () => {
    renderCard()
    expect(screen.queryByTestId('site-session-delete-primary')).not.toBeInTheDocument()
  })

  it('asks which account a pending session belongs to', () => {
    renderCard({ ...GOOGLE_VIEW, hasPendingSession: true })
    expect(screen.getByTestId('site-session-pending-row')).toBeInTheDocument()
  })

  it('keeps the question away while no session waits', () => {
    renderCard()
    expect(screen.queryByTestId('site-session-pending-row')).not.toBeInTheDocument()
  })

  it('shows the site name and the host it belongs to', () => {
    renderCard(CHATGPT_VIEW)

    expect(screen.getByText('ws_target_chatgpt')).toBeInTheDocument()
    expect(screen.getByText('chatgpt.com')).toBeInTheDocument()
  })

  it('shows how many accounts the site holds', () => {
    renderCard()
    expect(screen.getByText('ws_accounts_count 2')).toBeInTheDocument()
  })

  it('names the apps of the Google row instead of their hosts', () => {
    renderCard(GOOGLE_VIEW)

    expect(screen.getByText('Gemini, AI Studio, YouTube, Google Drive')).toBeInTheDocument()
    expect(screen.queryByText('gemini.google.com')).not.toBeInTheDocument()
  })

  it('tells the user that the Google account also signs the Drive panel out', () => {
    renderCard(GOOGLE_VIEW)
    expect(screen.getByText('ws_google_drive_note')).toBeInTheDocument()
  })

  describe('the attribution the user gave', () => {
    it('names the account a held session was attributed to', () => {
      renderCard({ ...GOOGLE_VIEW, attributedAccountId: 'a1' })

      expect(screen.getByTestId('site-session-attribution')).toBeInTheDocument()
      expect(screen.getByText('ws_attribution_label Kisisel')).toBeInTheDocument()
    })

    it('names an account without a name by its place in the site', () => {
      renderCard({ ...GOOGLE_VIEW, attributedAccountId: 'unknown' })

      expect(screen.getByText('ws_attribution_label unknown')).toBeInTheDocument()
    })

    it('stays away while the user has not answered', () => {
      renderCard()

      expect(screen.queryByTestId('site-session-attribution')).not.toBeInTheDocument()
    })

    it('asks to be asked again about a session that fits no other rule', async () => {
      // The extension polls the config version: clearing the attribution makes
      // it push every site again, so the question comes back into the card.
      const actions = renderCard({ ...GOOGLE_VIEW, attributedAccountId: 'a1' })

      fireEvent.click(screen.getByRole('button', { name: 'ws_attribution_reask' }))

      expect(actions.onReAskAttribution).toHaveBeenCalledWith('google')
    })

    it('locks the re-ask while an action is running', () => {
      render(
        <SiteSessionCard
          view={{ ...GOOGLE_VIEW, attributedAccountId: 'a1' }}
          disabled
          actions={{
            onToggle: vi.fn(),
            onSetActive: vi.fn(),
            onRename: vi.fn(),
            onDelete: vi.fn(),
            onResolvePending: vi.fn(),
            onReAskAttribution: vi.fn()
          }}
          t={t}
        />
      )

      expect(screen.getByRole('button', { name: 'ws_attribution_reask' })).toBeDisabled()
    })
  })

  // The switch belongs to the account, not to the site: every account of the
  // site has its own.
  it('shows a switch for every account of the site', () => {
    renderCard()
    expect(screen.getAllByRole('switch')).toHaveLength(2)
  })

  it('locks the switches while an action is running', () => {
    render(
      <SiteSessionCard
        view={GOOGLE_VIEW}
        disabled
        actions={{
          onToggle: vi.fn(),
          onSetActive: vi.fn(),
          onRename: vi.fn(),
          onDelete: vi.fn(),
          onResolvePending: vi.fn(),
          onReAskAttribution: vi.fn()
        }}
        t={t}
      />
    )

    expect(screen.getAllByRole('switch')[0]).toBeDisabled()
  })
})
