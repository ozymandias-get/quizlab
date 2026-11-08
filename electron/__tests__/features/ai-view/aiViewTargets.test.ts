import { describe, expect, it, vi } from 'vitest'

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

const { resolveAiViewTarget } = await import('../../../features/ai-view/aiViewTargets.js')

describe('resolveAiViewTarget - Google apps', () => {
  it('opens a Google app on the single shared partition with its plain registry url', async () => {
    const target = await resolveAiViewTarget({ kind: 'google-web-app', appId: 'gemini' })
    expect(target?.partition).toBe('persist:gemini_web_profile')
    expect(target?.url).toBe('https://gemini.google.com/app')
  })
})
