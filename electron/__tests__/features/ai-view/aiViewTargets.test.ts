import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureGoogleSessionSlot = vi.hoisted(() =>
  vi.fn(async (_slot: number) => ({ ok: true, ready: true, status: 'ready' as string }))
)

vi.mock('../../../app/window/permissionPolicy.js', () => ({
  isAllowedManagedViewPartition: (partition: unknown) =>
    typeof partition === 'string' && partition.startsWith('persist:'),
  isHostTrustedForPartition: () => true
}))

vi.mock('../../../features/ai/aiManager.js', () => ({
  AI_REGISTRY: {},
  INACTIVE_PLATFORMS: {},
  CHROME_USER_AGENT: ''
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => ({})
}))

vi.mock('../../../features/web-session/googleSessionSlot.js', () => ({
  ensureGoogleSessionSlot
}))

vi.mock('../../../features/web-session/siteSessionConfig.js', () => ({
  getSiteSessionConfig: () => ({ read: async () => ({ targets: {} }) })
}))

const { resolveAiViewTarget } = await import('../../../features/ai-view/aiViewTargets.js')

describe('resolveAiViewTarget - Google slot preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureGoogleSessionSlot.mockResolvedValue({ ok: true, ready: true, status: 'ready' })
  })

  it('keeps the requested partition and slots the url when the slot is ready', async () => {
    const target = await resolveAiViewTarget({
      kind: 'google-web-app',
      appId: 'gemini',
      sessionSlot: 2
    })
    expect(ensureGoogleSessionSlot).toHaveBeenCalledWith(2)
    expect(target?.partition).toBe('persist:gemini_web_profile_slot_2')
    expect(target?.url).toBe('https://gemini.google.com/u/1/app?authuser=1')
  })

  it('falls back to the primary session when the slot import failed', async () => {
    // A failed seed leaves the slot partition holding cookies nobody can vouch
    // for; loading it anyway would strand the tab on a broken account copy.
    ensureGoogleSessionSlot.mockResolvedValue({
      ok: false,
      ready: false,
      status: 'import_failed'
    })
    const target = await resolveAiViewTarget({
      kind: 'google-web-app',
      appId: 'gemini',
      sessionSlot: 2
    })
    expect(target?.partition).toBe('persist:gemini_web_profile')
    expect(target?.url).toBe('https://gemini.google.com/u/0/app?authuser=0')
  })

  it('falls back to the primary session when there is no login to copy', async () => {
    ensureGoogleSessionSlot.mockResolvedValue({ ok: true, ready: false, status: 'no_source' })
    const target = await resolveAiViewTarget({
      kind: 'google-web-app',
      appId: 'gemini',
      sessionSlot: 3
    })
    expect(target?.partition).toBe('persist:gemini_web_profile')
  })

  it('keeps the slot when only the import switch is off', async () => {
    // The switch off is not a broken slot: nothing failed, and a user who
    // opens a slot with the switch off must not be moved onto another account.
    ensureGoogleSessionSlot.mockResolvedValue({ ok: true, ready: false, status: 'disabled' })
    const target = await resolveAiViewTarget({
      kind: 'google-web-app',
      appId: 'gemini',
      sessionSlot: 3
    })
    expect(target?.partition).toBe('persist:gemini_web_profile_slot_3')
    expect(target?.url).toBe('https://gemini.google.com/u/2/app?authuser=2')
  })
})
