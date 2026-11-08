import type { NativeMessagingExtensionProfile } from '@shared-core/types'

import ExtensionProfileSelector from '@features/settings/ui/siteSessions/components/ExtensionProfileSelector'

import { fireEvent, render, screen } from '@testing-library/react'
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
  }
]

const selectProfile = vi.fn(async () => ({ success: true }))
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

    fireEvent.click(screen.getByRole('button', { name: 'ws_profile_select_btn' }))

    expect(selectProfile).toHaveBeenCalledWith({ profileId: 'profile-b-1234' })
  })
})
