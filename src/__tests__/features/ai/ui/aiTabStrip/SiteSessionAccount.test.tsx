/**
 * The account a site is opened with, as the panel shows it.
 *
 * A site may hold several accounts in separate cookie jars. The tab names the
 * account that is open, and the tab menu is the place the other accounts are
 * offered: switching there is what makes the next view of the site open in
 * another jar.
 */
import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import AiTabStrip from '@features/ai/ui/AiTabStrip'
import { TooltipProvider } from '@shared/ui/components/primitives'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The list the panel reads, plus the action the menu performs on it. */
const siteSession = vi.hoisted(() => ({
  accountViews: [] as SiteSessionSiteView[],
  setActiveAccount: vi.fn()
}))

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: () => ({
    data: {
      accountViews: siteSession.accountViews,
      extensionConnected: true,
      extensionVersionOk: true
    }
  }),
  useSetSiteSessionActiveAccountMutation: () => ({ mutate: siteSession.setActiveAccount })
}))

vi.mock('@app/providers/ai-context', () => ({
  useAiTabsSliceState: () => ({
    tabs: [{ id: 'tab-1', modelId: 'chatgpt', title: 'ChatGPT' }],
    activeTabId: 'tab-1'
  }),
  useAiSites: () => ({
    chatgpt: { displayName: 'ChatGPT', name: 'ChatGPT', color: '#10a37f' }
  }),
  useAiContentPresence: () => ({ hasActiveContent: true }),
  useAiTabActions: () => ({
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
    togglePinTab: vi.fn()
  }),
  useAiContentHostActions: () => ({ reloadActiveContent: vi.fn() })
}))

function account(overrides: Partial<SiteSessionAccountView> = {}): SiteSessionAccountView {
  return {
    accountId: 'primary',
    name: null,
    index: 1,
    enabled: false,
    status: 'signed_out',
    importedAt: null,
    lastError: null,
    isActive: false,
    isPrimary: true,
    ...overrides
  }
}

function chatgptSite(
  accounts: SiteSessionAccountView[],
  activeAccountId: string | null
): SiteSessionSiteView {
  return {
    siteId: 'chatgpt',
    labelKey: 'ws_target_chatgpt',
    hostname: 'chatgpt.com',
    kind: 'builtin',
    memberAppIds: ['chatgpt'],
    accounts,
    activeAccountId,
    hasPendingSession: false
  }
}

function renderStrip() {
  return render(
    <TooltipProvider>
      <AiTabStrip />
    </TooltipProvider>
  )
}

describe('the account of a site in the panel', () => {
  beforeEach(() => {
    siteSession.setActiveAccount.mockReset()
  })

  it('shows the account of the site in the tab', () => {
    siteSession.accountViews = [
      chatgptSite(
        [
          account({ isActive: false }),
          account({
            accountId: 'personal',
            name: 'Kişisel',
            index: 2,
            isActive: true,
            isPrimary: false
          })
        ],
        'personal'
      )
    ]

    renderStrip()

    expect(screen.getByText('Kişisel')).toBeInTheDocument()
    expect(screen.getByTestId('site-session-account-badge')).toBeInTheDocument()
  })

  it('offers the accounts of the site in the tab menu', () => {
    siteSession.accountViews = [
      chatgptSite(
        [
          account({ isActive: true }),
          account({ accountId: 'work', name: 'İş', index: 2, isPrimary: false })
        ],
        'primary'
      )
    ]

    renderStrip()
    fireEvent.contextMenu(screen.getByRole('tab'))

    expect(screen.getByText('İş')).toBeInTheDocument()

    fireEvent.click(screen.getByText('İş'))

    expect(siteSession.setActiveAccount).toHaveBeenCalledWith({
      siteId: 'chatgpt',
      accountId: 'work'
    })
  })

  it('does not show an account badge for a site with one account', () => {
    siteSession.accountViews = [
      chatgptSite([account({ name: 'Kişisel', isActive: true })], 'primary')
    ]

    renderStrip()

    expect(screen.queryByTestId('site-session-account-badge')).not.toBeInTheDocument()
  })
})
