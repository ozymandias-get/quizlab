import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import { GeminiToolButton } from '@app/ui/BottomBar/FloatingDockToolButtons'

import { TooltipProvider } from '@shared/ui/components/primitives'

import { fireEvent, render, screen } from '@testing-library/react'
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
const siteWith = (accounts: SiteSessionAccountView[], siteId = 'chatgpt'): SiteSessionSiteView => ({
  siteId,
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
  useAppearance: () => ({}),
  useAppToolActions: () => ({}),
  useAppToolPickerState: () => ({})
}))

vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({ enabledModels: [], aiSites: {} }),
  useAiTabActions: () => ({})
}))

vi.mock('@features/pdf', () => ({
  usePdfTabStore: () => ({})
}))

describe('GeminiToolButton', () => {
  beforeEach(() => {
    mockSites = []
  })

  const renderButton = (onOpenSettings: (tab?: string) => void = vi.fn()) =>
    render(
      <TooltipProvider>
        <GeminiToolButton onOpenSettings={onOpenSettings} />
      </TooltipProvider>
    )

  it('stays hidden while no account imports a session', () => {
    renderButton()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens the site sessions tab', () => {
    mockSites = [siteWith([{ ...SIGNED_OUT_ACCOUNT, enabled: true }])]
    const onOpenSettings = vi.fn()

    renderButton(onOpenSettings)
    fireEvent.click(screen.getByRole('button', { name: 'ws_toolbar_title' }))

    expect(onOpenSettings).toHaveBeenCalledWith('site-sessions')
  })

  it('asks for attention when an account that imports a session cannot work', () => {
    mockSites = [siteWith([{ ...SIGNED_OUT_ACCOUNT, enabled: true, status: 'permission_missing' }])]

    renderButton()

    expect(screen.getByRole('button', { name: 'ws_toolbar_attention' })).toBeInTheDocument()
  })

  it('asks for attention when Chrome has no session for the account', () => {
    mockSites = [
      siteWith([{ ...SIGNED_OUT_ACCOUNT, enabled: true, status: 'no_cookies_in_browser' }])
    ]

    renderButton()

    expect(screen.getByRole('button', { name: 'ws_toolbar_attention' })).toBeInTheDocument()
  })

  it('stays quiet about an account whose import is off', () => {
    mockSites = [
      siteWith([{ ...SIGNED_OUT_ACCOUNT, enabled: true, status: 'imported' }]),
      siteWith([{ ...SIGNED_OUT_ACCOUNT, enabled: false, status: 'permission_missing' }], 'claude')
    ]

    renderButton()

    expect(screen.getByRole('button', { name: 'ws_toolbar_title' })).toBeInTheDocument()
  })
})
