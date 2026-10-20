import type { SiteSessionView } from '@shared-core/types/siteSession'

import { GeminiToolButton } from '@app/ui/BottomBar/FloatingDockToolButtons'

import { TooltipProvider } from '@shared/ui/components/primitives'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SIGNED_OUT_VIEW: SiteSessionView = {
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

let mockViews: SiteSessionView[] = []

vi.mock('@platform/electron/api/useSiteSessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@platform/electron/api/useSiteSessionApi')>()
  return {
    ...actual,
    useSiteSessionListQuery: () => ({
      data: { views: mockViews, extensionConnected: true, extensionVersionOk: true },
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
    mockViews = []
  })

  const renderButton = (onOpenSettings: (tab?: string) => void = vi.fn()) =>
    render(
      <TooltipProvider>
        <GeminiToolButton onOpenSettings={onOpenSettings} />
      </TooltipProvider>
    )

  it('stays hidden while no site imports a session', () => {
    renderButton()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens the site sessions tab', () => {
    mockViews = [{ ...SIGNED_OUT_VIEW, enabled: true }]
    const onOpenSettings = vi.fn()

    renderButton(onOpenSettings)
    fireEvent.click(screen.getByRole('button', { name: 'ws_toolbar_title' }))

    expect(onOpenSettings).toHaveBeenCalledWith('site-sessions')
  })

  it('asks for attention when a site that imports a session cannot work', () => {
    mockViews = [{ ...SIGNED_OUT_VIEW, enabled: true, status: 'permission_missing' }]

    renderButton()

    expect(screen.getByRole('button', { name: 'ws_toolbar_attention' })).toBeInTheDocument()
  })

  it('stays quiet about a site whose import is off', () => {
    mockViews = [
      { ...SIGNED_OUT_VIEW, enabled: true, status: 'imported' },
      {
        ...SIGNED_OUT_VIEW,
        siteId: 'claude',
        enabled: false,
        status: 'permission_missing'
      }
    ]

    renderButton()

    expect(screen.getByRole('button', { name: 'ws_toolbar_title' })).toBeInTheDocument()
  })
})
