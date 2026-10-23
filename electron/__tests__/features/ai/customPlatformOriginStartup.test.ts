/**
 * Tests for electron/features/ai/customPlatformOriginStartup.ts
 *
 * A custom platform the user added is stored in its own file, so its origin
 * was registered on daily use at first and then on every read of the registry.
 * A restored tab of such a platform has to pass the fail-closed gate before
 * the renderer asks for the registry once, so the registration is part of the
 * composition root's start-up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readCustomPlatforms = vi.hoisted(() => vi.fn(async () => ({})))
const resolveActiveAccountPartition = vi.hoisted(() =>
  vi.fn(async (): Promise<string | null> => null)
)

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms
}))

vi.mock('../../../features/web-session/siteSessionAccounts.js', () => ({
  resolveActiveAccountPartition
}))

import {
  isAllowedManagedViewPartition,
  resetCustomPlatformOrigins,
  unregisterCustomPlatformOrigin
} from '../../../app/window/permissionPolicy.js'
import { registerCustomPlatformOriginsAtStartup } from '../../../features/ai/customPlatformOriginStartup.js'
import { resolveAiViewTarget } from '../../../features/ai-view/aiViewTargets.js'

const CUSTOM_PARTITION = 'persist:ai_custom_custom_1'

const CUSTOM_PLATFORMS = {
  custom_1: {
    id: 'custom_1',
    name: 'Local',
    displayName: 'Local',
    url: 'https://local.test',
    isSite: true,
    isCustom: true,
    partition: CUSTOM_PARTITION,
    submitMode: 'enter_key'
  }
}

describe('the custom platform origins at start-up', () => {
  beforeEach(() => {
    readCustomPlatforms.mockClear()
    readCustomPlatforms.mockImplementation(async () => ({}))
    resolveActiveAccountPartition.mockClear()
    resolveActiveAccountPartition.mockImplementation(async () => null)
  })

  afterEach(() => {
    resetCustomPlatformOrigins()
  })

  it('registers the origin the user chose for a persisted custom platform', async () => {
    readCustomPlatforms.mockImplementation(async () => CUSTOM_PLATFORMS)

    expect(isAllowedManagedViewPartition(CUSTOM_PARTITION)).toBe(false)

    await registerCustomPlatformOriginsAtStartup()

    expect(isAllowedManagedViewPartition(CUSTOM_PARTITION)).toBe(true)
  })

  it('lets a restored tab of a custom platform open before the first registry read', async () => {
    readCustomPlatforms.mockImplementation(async () => CUSTOM_PLATFORMS)

    await registerCustomPlatformOriginsAtStartup()

    const target = await resolveAiViewTarget({ kind: 'ai-platform', modelId: 'custom_1' })

    expect(target).not.toBeNull()
    expect(target?.partition).toBe(CUSTOM_PARTITION)
    expect(target?.url).toBe('https://local.test/')
  })

  it('keeps refusing the partition of a custom platform nobody chose an origin for', async () => {
    readCustomPlatforms.mockImplementation(async () => CUSTOM_PLATFORMS)

    const target = await resolveAiViewTarget({ kind: 'ai-platform', modelId: 'custom_1' })

    expect(target).toBeNull()
  })

  it('ignores platforms whose partition is not the custom one', async () => {
    readCustomPlatforms.mockImplementation(async () => ({
      gemini: { id: 'gemini', name: 'g', url: 'https://example.test' }
    }))

    await registerCustomPlatformOriginsAtStartup()

    expect(isAllowedManagedViewPartition('gemini')).toBe(false)
    expect(isAllowedManagedViewPartition(CUSTOM_PARTITION)).toBe(false)
  })

  it('survives a store that cannot be read', async () => {
    readCustomPlatforms.mockRejectedValue(new Error('disk broken'))

    await expect(registerCustomPlatformOriginsAtStartup()).resolves.toBeUndefined()

    expect(isAllowedManagedViewPartition(CUSTOM_PARTITION)).toBe(false)
  })

  it('forgets the origins again when the seam drops them', async () => {
    readCustomPlatforms.mockImplementation(async () => CUSTOM_PLATFORMS)
    await registerCustomPlatformOriginsAtStartup()

    unregisterCustomPlatformOrigin(CUSTOM_PARTITION)

    expect(isAllowedManagedViewPartition(CUSTOM_PARTITION)).toBe(false)
  })
})
