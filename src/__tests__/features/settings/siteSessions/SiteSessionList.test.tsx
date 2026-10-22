import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import SiteSessionList from '@features/settings/ui/siteSessions/SiteSessionList'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const ACCOUNT: SiteSessionAccountView = {
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

const VIEWS: SiteSessionSiteView[] = [
  {
    siteId: 'chatgpt',
    labelKey: 'ws_target_chatgpt',
    hostname: 'chatgpt.com',
    kind: 'builtin',
    memberAppIds: ['chatgpt'],
    accounts: [ACCOUNT],
    activeAccountId: null,
    hasPendingSession: false
  },
  {
    siteId: 'google',
    labelKey: 'ws_target_google',
    hostname: 'accounts.google.com',
    kind: 'google',
    memberAppIds: ['gemini', 'aistudio', 'youtube', 'gdrive'],
    accounts: [ACCOUNT],
    activeAccountId: null,
    hasPendingSession: false
  }
]

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key

const actions = {
  onToggle: vi.fn(),
  onSetActive: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onResolvePending: vi.fn()
}

describe('SiteSessionList', () => {
  it('renders one card per site', () => {
    render(<SiteSessionList views={VIEWS} disabled={false} actions={actions} t={t} />)
    expect(screen.getAllByTestId('site-session-account-row')).toHaveLength(2)
  })

  // The service decides the order (the Google group first, then the registry
  // order, then the user's own sites). The list must not sort it again.
  it('keeps the order the service returned', () => {
    render(<SiteSessionList views={VIEWS} disabled={false} actions={actions} t={t} />)

    const titles = screen.getAllByText(/^ws_target_/).map((element) => element.textContent)
    expect(titles).toEqual(['ws_target_chatgpt', 'ws_target_google'])
  })
})
