/**
 * The view follows the account its site is opened with.
 *
 * The panel learns about a switch through the site-session list, which the main
 * process refreshes after every account action. The managed view has to be
 * rebuilt then, because its `WebContentsView` lives in the cookie jar of the
 * account it was created with; a navigation inside the old view would keep
 * using the old jar.
 */
import type { SiteSessionAccountView, SiteSessionSiteView } from '@shared-core/types/siteSession'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The list `useSiteSessionListQuery` hands the hook. */
const siteSession = vi.hoisted(() => ({ accountViews: [] as SiteSessionSiteView[] }))

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: () => ({ data: { accountViews: siteSession.accountViews } })
}))

const aiViewClient = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(async () => true),
  destroy: vi.fn(async () => true),
  reload: vi.fn(async () => true),
  loadUrl: vi.fn(async () => true),
  navigate: vi.fn(async () => true),
  getUrl: vi.fn(async () => 'https://x.test/'),
  executeScript: vi.fn(async () => 'ok'),
  insertText: vi.fn(async () => true),
  sendInputEvent: vi.fn(async () => true),
  paste: vi.fn(async () => true),
  focus: vi.fn(async () => true),
  syncHost: vi.fn(),
  onEvent: vi.fn((_handler: (event: unknown) => void) => () => {})
}))

const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  reportSuppressedError: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showWarning: vi.fn(), showError: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const { useManagedContentView } = await import('@shared/hooks/aiContent/useManagedContentView')

const freshAttachResponse = () => ({
  generation: 1,
  currentUrl: 'https://chatgpt.com/',
  isLoading: true,
  hasLoadedOnce: false,
  error: null
})

const baseOptions = {
  viewId: 'tab-1',
  source: { kind: 'ai-platform' as const, modelId: 'chatgpt' },
  restoredUrl: 'https://chatgpt.com/c/keep',
  modelId: 'chatgpt',
  showWarning: vi.fn(),
  isEnabled: true,
  isHostOwner: true,
  visible: true
}

function account(accountId: string, index: number): SiteSessionAccountView {
  return {
    accountId,
    name: null,
    index,
    enabled: false,
    status: 'signed_out',
    importedAt: null,
    lastError: null,
    isActive: false,
    isPrimary: index === 1
  }
}

function chatgptSite(activeAccountId: string | null): SiteSessionSiteView {
  return {
    siteId: 'chatgpt',
    labelKey: 'ws_target_chatgpt',
    hostname: 'chatgpt.com',
    kind: 'builtin',
    memberAppIds: ['chatgpt'],
    accounts: [account('primary', 1), account('work', 2)],
    activeAccountId,
    hasPendingSession: false
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
  })
}

async function mount(options: Partial<typeof baseOptions> = {}) {
  const utils = renderHook(
    (props: Parameters<typeof useManagedContentView>[0]) => useManagedContentView(props),
    { initialProps: { ...baseOptions, ...options } }
  )
  await flush()
  return utils
}

describe('useManagedContentView - the active account of a site', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    siteSession.accountViews = []
    aiViewClient.attach.mockResolvedValue(freshAttachResponse())
    aiViewClient.onEvent.mockImplementation(() => () => {})
  })

  it('reopens the view when the active account of its site changes', async () => {
    siteSession.accountViews = [chatgptSite('primary')]
    const { rerender } = await mount()

    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
    expect(aiViewClient.destroy).not.toHaveBeenCalled()

    siteSession.accountViews = [chatgptSite('work')]
    rerender({ ...baseOptions })
    await flush()

    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })
    expect(aiViewClient.attach).toHaveBeenCalledTimes(2)
    expect(aiViewClient.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({
        viewId: 'tab-1',
        restoredUrl: 'https://chatgpt.com/c/keep'
      })
    )
  })

  it('keeps the view when the list refreshes on the same account', async () => {
    siteSession.accountViews = [chatgptSite('work')]
    const { rerender } = await mount()

    siteSession.accountViews = [chatgptSite('work')]
    rerender({ ...baseOptions })
    await flush()

    expect(aiViewClient.destroy).not.toHaveBeenCalled()
    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
  })

  it('does not reopen the view for the first account it learns about', async () => {
    const { rerender } = await mount()
    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)

    // The list may arrive after the attach: the view already opened with the
    // account the main process had, so hearing about it is not a switch.
    siteSession.accountViews = [chatgptSite('work')]
    rerender({ ...baseOptions })
    await flush()

    expect(aiViewClient.destroy).not.toHaveBeenCalled()
    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
  })

  it('does not rebuild a view that is asleep, and wakes into the new account', async () => {
    siteSession.accountViews = [chatgptSite('primary')]
    const { rerender } = await mount({ isEnabled: false })
    // Going to sleep is a teardown of its own; what matters here is that the
    // account switch does not start another one.
    vi.clearAllMocks()

    siteSession.accountViews = [chatgptSite('work')]
    rerender({ ...baseOptions, isEnabled: false })
    await flush()

    expect(aiViewClient.destroy).not.toHaveBeenCalled()
    expect(aiViewClient.attach).not.toHaveBeenCalled()

    rerender({ ...baseOptions, isEnabled: true })
    await flush()

    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })
})
