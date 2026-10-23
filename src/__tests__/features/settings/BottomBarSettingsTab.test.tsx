import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import BottomBarSettingsTab from '@features/settings/ui/BottomBarSettingsTab'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SIGNED_OUT_ACCOUNT: SiteSessionAccountView = {
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

/** One site with the accounts it holds. */
const siteWith = (accounts: SiteSessionAccountView[]): SiteSessionSiteView => ({
  siteId: 'chatgpt',
  labelKey: 'ws_target_chatgpt',
  hostname: 'chatgpt.com',
  kind: 'builtin',
  memberAppIds: ['chatgpt'],
  accounts,
  activeAccountId: null,
  attributedAccountId: null,
  hasPendingSession: false
})

let mockSites: SiteSessionSiteView[] = []

vi.mock('@platform/electron/api/useSiteSessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@platform/electron/api/useSiteSessionApi')>()
  return {
    ...actual,
    useSiteSessionListQuery: () => ({
      data: {
        accountViews: mockSites,
        extensionConnected: true,
        extensionVersionOk: true
      },
      isLoading: false
    })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@app/providers', () => ({
  useAppearance: (selector: (state: unknown) => unknown) =>
    selector({
      visibleTools: {},
      visibleModels: {},
      setVisibleTool: vi.fn(),
      setVisibleModel: vi.fn()
    })
}))

vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({ enabledModels: [], aiSites: {} }),
  useAiModelActions: () => ({ setEnabledModels: vi.fn() })
}))

describe('BottomBarSettingsTab', () => {
  beforeEach(() => {
    mockSites = []
  })

  it('hides the site session tool while no account imports a session', () => {
    render(<BottomBarSettingsTab />)
    expect(screen.queryByText('tool_site_sessions')).not.toBeInTheDocument()
  })

  it('offers the site session tool once an account imports a session', () => {
    mockSites = [siteWith([{ ...SIGNED_OUT_ACCOUNT, enabled: true }])]

    render(<BottomBarSettingsTab />)
    expect(screen.getByText('tool_site_sessions')).toBeInTheDocument()
  })
})
