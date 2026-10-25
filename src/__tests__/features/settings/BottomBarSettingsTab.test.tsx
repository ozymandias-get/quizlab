import type { SiteSessionView } from '@shared-core/types/siteSession'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'

import BottomBarSettingsTab from '@features/settings/ui/BottomBarSettingsTab'

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
let mockEnabledModels: string[] = []
let mockVisibility: Record<string, boolean> = {}
const mockSetVisibleModel = vi.fn()

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
  useAppearance: (selector: (state: unknown) => unknown) =>
    selector({
      visibleTools: {},
      visibleModels: mockVisibility,
      setVisibleTool: vi.fn(),
      setVisibleModel: mockSetVisibleModel,
      bottomBarMaxIcons: 10,
      setBottomBarMaxIcons: vi.fn()
    })
}))

vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({ enabledModels: mockEnabledModels, aiSites: WEB_AI_REGISTRY }),
  useAiModelActions: () => ({ setEnabledModels: vi.fn() })
}))

describe('BottomBarSettingsTab', () => {
  beforeEach(() => {
    mockViews = []
    mockEnabledModels = []
    mockVisibility = {}
    mockSetVisibleModel.mockClear()
  })

  it('hides the site session tool while no site imports a session', () => {
    render(<BottomBarSettingsTab />)
    expect(screen.queryByText('tool_site_sessions')).not.toBeInTheDocument()
  })

  it('offers the site session tool once a site imports a session', () => {
    mockViews = [{ ...SIGNED_OUT_VIEW, enabled: true }]

    render(<BottomBarSettingsTab />)
    expect(screen.getByText('tool_site_sessions')).toBeInTheDocument()
  })

  it('keeps an enabled catalogue service hidden until its shortcut is selected', () => {
    mockEnabledModels = ['chatgpt', 'poe']
    const { unmount } = render(<BottomBarSettingsTab />)
    expect(screen.getByRole('switch', { name: 'ChatGPT' })).toHaveAttribute('aria-checked', 'true')
    const poe = screen.getByRole('switch', { name: 'Poe' })
    expect(poe).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(poe)
    expect(mockSetVisibleModel).toHaveBeenCalledWith('poe', true)
    mockVisibility = { poe: true }
    unmount()
    render(<BottomBarSettingsTab />)
    expect(screen.getByRole('switch', { name: 'Poe' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('switch', { name: 'Poe' }))
    expect(mockSetVisibleModel).toHaveBeenLastCalledWith('poe', false)
  })
})
