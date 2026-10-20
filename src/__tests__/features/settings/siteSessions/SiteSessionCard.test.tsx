import type { SiteSessionView } from '@shared-core/types/siteSession'

import SiteSessionCard from '@features/settings/ui/siteSessions/SiteSessionCard'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const VIEW: SiteSessionView = {
  siteId: 'chatgpt',
  labelKey: 'ws_target_chatgpt',
  hostname: 'chatgpt.com',
  kind: 'builtin',
  memberAppIds: ['chatgpt'],
  enabled: false,
  status: 'signed_out',
  importedAt: null,
  lastError: null
}

const GOOGLE_VIEW: SiteSessionView = {
  ...VIEW,
  siteId: 'google',
  labelKey: 'ws_target_google',
  hostname: 'accounts.google.com',
  kind: 'google',
  memberAppIds: ['gemini', 'aistudio', 'youtube', 'gdrive']
}

/** The card asks for a translation; the test shows the key and its values. */
const t = (key: string, params?: Record<string, string>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key

/** The id of the switch a card rendered. */
const switchIdOf = (container: HTMLElement): string | null | undefined =>
  container.querySelector('button[role="switch"]')?.getAttribute('id')

describe('SiteSessionCard', () => {
  it('shows the import switch', () => {
    render(<SiteSessionCard view={VIEW} disabled={false} onToggle={() => {}} t={t} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('shows the signed out state for a site without a session', () => {
    render(<SiteSessionCard view={VIEW} disabled={false} onToggle={() => {}} t={t} />)
    expect(screen.getByText('ws_status_signed_out')).toBeInTheDocument()
  })

  it('tells the user that the Google row also signs out the Drive panel', () => {
    render(
      <SiteSessionCard
        view={{ ...VIEW, siteId: 'google', kind: 'google' }}
        disabled={false}
        onToggle={() => {}}
        t={t}
      />
    )
    expect(screen.getByText('ws_google_drive_note')).toBeInTheDocument()
  })

  it('shows the site name and the host it belongs to', () => {
    render(<SiteSessionCard view={VIEW} disabled={false} onToggle={() => {}} t={t} />)
    expect(screen.getByText('ws_target_chatgpt')).toBeInTheDocument()
    expect(screen.getByText('chatgpt.com')).toBeInTheDocument()
  })

  it('names the switch that pulls the session from Chrome', () => {
    render(<SiteSessionCard view={VIEW} disabled={false} onToggle={() => {}} t={t} />)
    expect(screen.getByText('ws_toggle_label')).toBeInTheDocument()
  })

  it('shows when the session was imported the last time', () => {
    render(
      <SiteSessionCard
        view={{ ...VIEW, status: 'imported', importedAt: '2026-04-08T10:00:00.000Z' }}
        disabled={false}
        onToggle={() => {}}
        t={t}
      />
    )
    expect(screen.getByText(/ws_last_pull/)).toBeInTheDocument()
  })

  it('names the apps the Google row covers', () => {
    render(<SiteSessionCard view={GOOGLE_VIEW} disabled={false} onToggle={() => {}} t={t} />)
    expect(screen.getByText('Gemini')).toBeInTheDocument()
    expect(screen.getByText('AI Studio')).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByText('Google Drive')).toBeInTheDocument()
  })

  it('reports the site id when the switch is flipped', () => {
    const onToggle = vi.fn()
    render(<SiteSessionCard view={VIEW} disabled={false} onToggle={onToggle} t={t} />)

    fireEvent.click(screen.getByRole('switch'))

    expect(onToggle).toHaveBeenCalledWith('chatgpt')
  })

  it('locks the switch while an action is running', () => {
    render(<SiteSessionCard view={VIEW} disabled onToggle={() => {}} t={t} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('shows why the last import failed', () => {
    render(
      <SiteSessionCard
        view={{ ...VIEW, status: 'import_failed', lastError: 'write_failed' }}
        disabled={false}
        onToggle={() => {}}
        t={t}
      />
    )
    expect(screen.getByText('ws_error_write_failed')).toBeInTheDocument()
  })

  it('gives every switch an accessible name of its own', () => {
    render(
      <>
        <SiteSessionCard view={VIEW} disabled={false} onToggle={() => {}} t={t} />
        <SiteSessionCard
          view={{ ...VIEW, siteId: 'claude', labelKey: 'ws_target_claude', hostname: 'claude.ai' }}
          disabled={false}
          onToggle={() => {}}
          t={t}
        />
      </>
    )

    expect(screen.getByRole('switch', { name: /chatgpt\.com/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /claude\.ai/ })).toBeInTheDocument()
  })

  // `custom:a.b` and `custom:a-b` differ, but a flattened id would not.
  it('gives two custom sites different element ids', () => {
    const dotted = render(
      <SiteSessionCard
        view={{ ...VIEW, siteId: 'custom:a.b', labelKey: 'ws_target_custom' }}
        disabled={false}
        onToggle={() => {}}
        t={t}
      />
    )
    const dashed = render(
      <SiteSessionCard
        view={{ ...VIEW, siteId: 'custom:a-b', labelKey: 'ws_target_custom' }}
        disabled={false}
        onToggle={() => {}}
        t={t}
      />
    )

    const dottedId = switchIdOf(dotted.container)
    const dashedId = switchIdOf(dashed.container)

    expect(dottedId).toBeTruthy()
    expect(dashedId).toBeTruthy()
    expect(dottedId).not.toBe(dashedId)
  })

  it('points the label at the switch of its own row', () => {
    const { container } = render(
      <SiteSessionCard
        view={{ ...VIEW, siteId: 'custom:a.b', labelKey: 'ws_target_custom' }}
        disabled={false}
        onToggle={() => {}}
        t={t}
      />
    )

    expect(container.querySelector('label')?.getAttribute('for')).toBe(switchIdOf(container))
  })
})
