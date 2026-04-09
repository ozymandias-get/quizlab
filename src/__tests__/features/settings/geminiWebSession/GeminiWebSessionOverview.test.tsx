import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GeminiWebSessionOverview from '@features/settings/ui/geminiWebSession/GeminiWebSessionOverview'
import type {
  GeminiWebSessionActionState,
  GeminiWebSessionHandlers,
  GeminiWebSessionStatusView
} from '@features/settings/ui/geminiWebSession/types'

const translations: Record<string, string> = {
  gws_title: 'Google AI Web Session',
  gws_reason_prefix: 'Reason',
  gws_last_check: 'Last check',
  gws_last_refreshed: 'Last refreshed',
  gws_last_refresh_reason: 'Last refresh reason',
  gws_toggle_label: 'Use Google AI Web Apps',
  gws_supported_apps_hint: 'Supported apps hint',
  gws_supported_apps_title: 'Supported Apps',
  gws_supported_apps_desc: 'Visible in this app',
  gws_login_btn: 'Login (Web)',
  gws_check_now_btn: 'Check Now',
  gws_reauth_btn: 'Reauthenticate',
  gws_reset_btn: 'Reset Profile',
  gws_refreshing_inline: 'Yenileniyor...',
  gws_refreshing_inline_desc: 'Sessiz yenileme devam ediyor.',
  gws_reauth_alert_title: 'Oturum süresi doldu',
  gws_reauth_alert_body:
    'Oturum süresi doldu. Güvenlik nedeniyle hesabınıza yeniden giriş yapmanız gerekmektedir.',
  gws_shared_account_note: 'Shared account note',
  gws_app_enabled: 'Enabled',
  gws_app_disabled: 'Disabled'
}

const t = (key: string) => translations[key] ?? key

const baseStatus: GeminiWebSessionStatusView = {
  state: 'authenticated',
  reason: 'none',
  checking: false,
  isRefreshing: false,
  featureEnabled: true,
  userEnabled: true,
  webEnabled: true,
  isAuthenticated: true,
  needsReauth: false,
  isDegraded: false,
  lastCheckAt: '2026-04-08T10:00:00.000Z',
  lastRefreshedAt: null,
  lastRefreshReason: null,
  requiresManualLogin: false,
  showReauthAlert: false
}

const baseActionState: GeminiWebSessionActionState = {
  isGeminiWebLoginInProgress: false,
  isCheckingWebNow: false,
  isReauthingWeb: false,
  isResettingWebProfile: false,
  isTogglingWebEnabled: false,
  isRefreshing: false
}

const baseHandlers: GeminiWebSessionHandlers = {
  onOpenWebLogin: vi.fn(),
  onCheckWebNow: vi.fn(),
  onReauthWeb: vi.fn(),
  onResetWebProfile: vi.fn(),
  onToggleWebEnabled: vi.fn(),
  onToggleManagedApp: vi.fn()
}

describe('GeminiWebSessionOverview', () => {
  it('renders inline refreshing state and disables manual actions while refreshing', () => {
    render(
      <GeminiWebSessionOverview
        t={t}
        status={{
          ...baseStatus,
          isRefreshing: true,
          lastRefreshedAt: '2026-04-08T09:50:00.000Z',
          lastRefreshReason: 'http_401'
        }}
        reasonText="No reason"
        refreshReasonText="401"
        stateText="Yenileniyor..."
        enabledAppIds={new Set(['gemini'])}
        actionState={{ ...baseActionState, isRefreshing: true }}
        handlers={baseHandlers}
      />
    )

    expect(screen.getAllByText('Yenileniyor...')).toHaveLength(2)
    expect(screen.getByText('Sessiz yenileme devam ediyor.')).toBeInTheDocument()
    expect(screen.getByText(/Last refreshed:/)).toBeInTheDocument()
    expect(screen.getByText(/Last refresh reason:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login (Web)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Check Now' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reauthenticate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset Profile' })).toBeDisabled()
  })

  it('shows compact reauth alert and promotes login CTA when manual login is required', () => {
    render(
      <GeminiWebSessionOverview
        t={t}
        status={{
          ...baseStatus,
          state: 'reauth_required',
          isAuthenticated: false,
          needsReauth: true,
          requiresManualLogin: true,
          showReauthAlert: true
        }}
        reasonText="Login redirect"
        refreshReasonText={null}
        stateText="Oturum yeniden doğrulama gerektiriyor."
        enabledAppIds={new Set(['gemini'])}
        actionState={baseActionState}
        handlers={baseHandlers}
      />
    )

    expect(screen.getByText('Oturum süresi doldu')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Oturum süresi doldu. Güvenlik nedeniyle hesabınıza yeniden giriş yapmanız gerekmektedir.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login (Web)' }).className).toContain('bg-rose-500')
  })

  it('keeps overview actions wired when refresh lock is not active', () => {
    const handlers: GeminiWebSessionHandlers = {
      ...baseHandlers,
      onCheckWebNow: vi.fn()
    }

    render(
      <GeminiWebSessionOverview
        t={t}
        status={baseStatus}
        reasonText="No reason"
        refreshReasonText={null}
        stateText="Authenticated"
        enabledAppIds={new Set(['gemini'])}
        actionState={baseActionState}
        handlers={handlers}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Check Now' }))
    expect(handlers.onCheckWebNow).toHaveBeenCalledTimes(1)
  })
})
