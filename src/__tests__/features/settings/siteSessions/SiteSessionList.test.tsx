import type { SiteSessionView } from '@shared-core/types/siteSession'

import SiteSessionList from '@features/settings/ui/siteSessions/SiteSessionList'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const VIEWS: SiteSessionView[] = [
  {
    siteId: 'chatgpt',
    labelKey: 'ws_target_chatgpt',
    hostname: 'chatgpt.com',
    kind: 'builtin',
    memberAppIds: ['chatgpt'],
    enabled: false,
    status: 'signed_out',
    importedAt: null,
    lastError: null
  },
  {
    siteId: 'google',
    labelKey: 'ws_target_google',
    hostname: 'accounts.google.com',
    kind: 'google',
    memberAppIds: ['gemini', 'aistudio', 'youtube', 'gdrive'],
    enabled: false,
    status: 'signed_out',
    importedAt: null,
    lastError: null
  }
]

const t = (key: string, params?: Record<string, string>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key

describe('SiteSessionList', () => {
  it('renders one card per site', () => {
    render(<SiteSessionList views={VIEWS} disabled={false} onToggle={() => {}} t={t} />)
    expect(screen.getAllByRole('switch')).toHaveLength(2)
  })

  // The service decides the order (the Google group first, then the registry
  // order, then the user's own sites). The list must not sort it again.
  it('keeps the order the service returned', () => {
    render(<SiteSessionList views={VIEWS} disabled={false} onToggle={() => {}} t={t} />)

    const titles = screen.getAllByText(/^ws_target_/).map((element) => element.textContent)
    expect(titles).toEqual(['ws_target_chatgpt', 'ws_target_google'])
  })
})
