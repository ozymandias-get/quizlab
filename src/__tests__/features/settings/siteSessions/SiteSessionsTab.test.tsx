import type { SiteSessionView } from '@shared-core/types/siteSession'

import SiteSessionsTab from '@features/settings/ui/siteSessions/SiteSessionsTab'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const VIEWS: SiteSessionView[] = [
  {
    siteId: 'chatgpt',
    labelKey: 'ws_target_chatgpt',
    hostname: 'chatgpt.com',
    kind: 'builtin',
    memberAppIds: ['chatgpt'],
    enabled: true,
    status: 'imported',
    importedAt: '2026-04-08T10:00:00.000Z',
    lastError: null
  }
]

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: () => ({
    data: { views: VIEWS, extensionConnected: true, extensionVersionOk: true },
    isLoading: false
  }),
  useSetSiteSessionEnabledMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClearSiteSessionMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({ data: null }),
  useNativeMessagingInstallExtension: () => ({ mutateAsync: vi.fn() }),
  useNativeMessagingRemoveExtension: () => ({ mutateAsync: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('SiteSessionsTab', () => {
  it('tells the user that turning the switch off erases the session', () => {
    render(<SiteSessionsTab />, { wrapper })
    expect(screen.getByText('ws_toggle_hint')).toBeInTheDocument()
  })

  // The switch stays on, so the extension pulls the sessions again.
  it('tells the user that clearing the sessions does not turn the import off', () => {
    render(<SiteSessionsTab />, { wrapper })
    expect(screen.getByText('ws_clear_all_hint')).toBeInTheDocument()
  })

  it('lists the sites', () => {
    render(<SiteSessionsTab />, { wrapper })
    expect(screen.getByText('ws_target_chatgpt')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })
})
