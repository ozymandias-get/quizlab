import type { NativeMessagingExtensionProfile } from '@shared-core/types'

import ExtensionProfileSelector from '@features/settings/ui/siteSessions/components/ExtensionProfileSelector'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const profiles: NativeMessagingExtensionProfile[] = [
  {
    id: 'profile-a-1234',
    name: 'Ana Chrome',
    connected: true,
    paired: true,
    protocolVersion: 3,
    selected: true
  },
  {
    id: 'profile-b-1234',
    name: 'İş Chrome',
    connected: true,
    paired: true,
    protocolVersion: 3,
    selected: false
  },
  {
    id: 'profile-c-1234',
    name: 'Eşleşmemiş Chrome',
    connected: true,
    paired: false,
    protocolVersion: 3,
    selected: false
  }
]

const selectProfile = vi.fn(async (): Promise<Record<string, unknown>> => ({ success: true }))
const showError = vi.fn()

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSelectExtensionProfileMutation: () => ({
    mutateAsync: selectProfile,
    isPending: false
  })
}))

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({
    data: { profiles, selectedProfileId: 'profile-a-1234' }
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({ showError })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

describe('ExtensionProfileSelector', () => {
  beforeEach(() => {
    selectProfile.mockClear()
    showError.mockClear()
  })

  it('lists every Chrome profile and marks the selected one', () => {
    render(<ExtensionProfileSelector t={(key) => key} />)

    expect(screen.getByText('Ana Chrome')).toBeInTheDocument()
    expect(screen.getByText('İş Chrome')).toBeInTheDocument()
    expect(screen.getAllByText('ws_profile_selected')).toHaveLength(2)
  })

  it('selects another profile when its button is pressed', () => {
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('İş Chrome').closest('[role="listitem"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'ws_profile_select_btn' }))

    expect(selectProfile).toHaveBeenCalledWith({ profileId: 'profile-b-1234' })
  })

  it('shows an origin-only profile as waiting for pairing, not as ready', () => {
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('Eşleşmemiş Chrome').closest('[role="listitem"]')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('ws_profile_pairing')).toBeInTheDocument()
    expect(within(row as HTMLElement).queryByText('ws_profile_connected')).not.toBeInTheDocument()
  })

  it('does not present a partial clear as a restored session', async () => {
    selectProfile.mockResolvedValueOnce({
      success: false,
      error: 'wipe_failed',
      clearedSiteIds: ['chatgpt'],
      failedSiteIds: ['claude'],
      partial: true,
      // The old profile was asked to push again; that is not proof that the
      // sessions are back.
      reimportRequested: true
    })
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('İş Chrome').closest('[role="listitem"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'ws_profile_select_btn' }))

    await waitFor(() => expect(showError).toHaveBeenCalledWith('ws_error_wipe_failed'))
    expect(screen.queryByText(/restored|reimported|geri yüklendi/i)).not.toBeInTheDocument()
  })
})
