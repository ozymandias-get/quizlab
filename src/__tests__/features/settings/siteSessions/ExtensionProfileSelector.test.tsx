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
const removeExtensionProfile = vi.fn(async (): Promise<Record<string, unknown>> => ({
  success: true
}))
const confirm = vi.fn(async (): Promise<boolean> => true)
const showError = vi.fn()
const showSuccess = vi.fn()

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSelectExtensionProfileMutation: () => ({
    mutateAsync: selectProfile,
    isPending: false
  })
}))

vi.mock('@platform/electron/api/useNativeMessagingApi', () => ({
  useNativeMessagingStatusQuery: () => ({
    data: { profiles, selectedProfileId: 'profile-a-1234' }
  }),
  useRemoveExtensionProfileMutation: () => ({
    mutateAsync: removeExtensionProfile,
    isPending: false
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({ showError, showSuccess })
}))

vi.mock('@shared/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm,
    props: {
      isOpen: false,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      title: ''
    }
  })
}))

vi.mock('@app/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

describe('ExtensionProfileSelector', () => {
  beforeEach(() => {
    selectProfile.mockClear()
    removeExtensionProfile.mockClear()
    removeExtensionProfile.mockResolvedValue({ success: true })
    confirm.mockClear()
    confirm.mockResolvedValue(true)
    showError.mockClear()
    showSuccess.mockClear()
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

  it('removes a profile that is not the source after the confirmation', async () => {
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('İş Chrome').closest('[role="listitem"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'ws_profile_remove_btn İş Chrome' }))

    await waitFor(() => expect(removeExtensionProfile).toHaveBeenCalledTimes(1))
    expect(removeExtensionProfile).toHaveBeenCalledWith({ profileId: 'profile-b-1234' })
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'ws_profile_remove_confirm_title',
        description: 'ws_profile_remove_confirm_other',
        variant: 'destructive'
      })
    )
    expect(showSuccess).toHaveBeenCalledWith('ws_profile_remove_success')
  })

  it('warns that removing the selected source also clears its sessions', async () => {
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('Ana Chrome').closest('[role="listitem"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'ws_profile_remove_btn Ana Chrome' }))

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'ws_profile_remove_confirm_selected' })
      )
    )
    await waitFor(() =>
      expect(removeExtensionProfile).toHaveBeenCalledWith({ profileId: 'profile-a-1234' })
    )
  })

  it('does not remove a profile when the confirmation is dismissed', async () => {
    confirm.mockResolvedValue(false)
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('İş Chrome').closest('[role="listitem"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'ws_profile_remove_btn İş Chrome' }))

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(removeExtensionProfile).not.toHaveBeenCalled()
  })

  it('reports a removal the app refused', async () => {
    removeExtensionProfile.mockResolvedValue({ success: false, error: 'wipe_failed' })
    render(<ExtensionProfileSelector t={(key) => key} />)

    const row = screen.getByText('Ana Chrome').closest('[role="listitem"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'ws_profile_remove_btn Ana Chrome' }))

    await waitFor(() => expect(showError).toHaveBeenCalledWith('ws_error_wipe_failed'))
    expect(showSuccess).not.toHaveBeenCalled()
  })
})
