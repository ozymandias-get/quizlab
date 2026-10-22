/**
 * Tests for electron/features/ai-view/aiViewTargets.ts
 *
 * The targets module is the bridge between the renderer's source key and the
 * partition the panel opens: these cases pin that the panel resolves the
 * active account's partition and keeps the platform partition as fallback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { readCustomPlatforms, resolveActiveAccountPartition } = vi.hoisted(() => ({
  readCustomPlatforms: vi.fn(async () => ({})),
  resolveActiveAccountPartition: vi.fn(async (): Promise<string | null> => null)
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms
}))

vi.mock('../../../features/web-session/siteSessionAccounts.js', () => ({
  resolveActiveAccountPartition
}))

import {
  registerAccountPartition,
  unregisterAccountPartition
} from '../../../app/window/permissionPolicy.js'
import { resolveAiViewTarget } from '../../../features/ai-view/aiViewTargets.js'

const GOOGLE_ACCOUNT_PARTITION = 'persist:ai_google_a1'
const CHATGPT_ACCOUNT_PARTITION = 'persist:ai_chatgpt_a1'

describe('resolveAiViewTarget partition', () => {
  beforeEach(() => {
    readCustomPlatforms.mockClear()
    readCustomPlatforms.mockImplementation(async () => ({}))
    resolveActiveAccountPartition.mockClear()
    resolveActiveAccountPartition.mockImplementation(async () => null)
  })

  afterEach(() => {
    unregisterAccountPartition(GOOGLE_ACCOUNT_PARTITION)
    unregisterAccountPartition(CHATGPT_ACCOUNT_PARTITION)
  })

  it('resolves the partition of the active account of the site', async () => {
    resolveActiveAccountPartition.mockResolvedValue(GOOGLE_ACCOUNT_PARTITION)
    registerAccountPartition(GOOGLE_ACCOUNT_PARTITION, 'https://gemini.google.com')

    const target = await resolveAiViewTarget({ kind: 'google-web-app', appId: 'gemini' })

    expect(target?.partition).toBe(GOOGLE_ACCOUNT_PARTITION)
    expect(target?.url).toBe('https://gemini.google.com/app')
  })

  it('falls back to the platform partition when the site has no account', async () => {
    resolveActiveAccountPartition.mockResolvedValue(null)

    const target = await resolveAiViewTarget({ kind: 'google-web-app', appId: 'gemini' })

    expect(target?.partition).toBe('persist:gemini_web_profile')
  })

  it('refuses a view whose active account partition was never registered', async () => {
    resolveActiveAccountPartition.mockResolvedValue(GOOGLE_ACCOUNT_PARTITION)

    const target = await resolveAiViewTarget({ kind: 'google-web-app', appId: 'gemini' })

    expect(target).toBeNull()
  })

  it('resolves the partition of the active account of a built-in platform', async () => {
    resolveActiveAccountPartition.mockResolvedValue(CHATGPT_ACCOUNT_PARTITION)
    registerAccountPartition(CHATGPT_ACCOUNT_PARTITION, 'https://chatgpt.com')

    const target = await resolveAiViewTarget({ kind: 'ai-platform', modelId: 'chatgpt' })

    expect(target?.partition).toBe(CHATGPT_ACCOUNT_PARTITION)
  })

  it('falls back to the platform partition when the platform has no active account', async () => {
    resolveActiveAccountPartition.mockResolvedValue(null)

    const target = await resolveAiViewTarget({ kind: 'ai-platform', modelId: 'chatgpt' })

    expect(target?.partition).toBe('persist:ai_chatgpt')
  })

  it('routes a user-added site through its own account', async () => {
    readCustomPlatforms.mockImplementation(async () => ({
      custom_1: {
        id: 'custom_1',
        name: 'Local',
        displayName: 'Local',
        url: 'https://local.test',
        partition: 'persist:ai_custom_custom_1'
      }
    }))
    resolveActiveAccountPartition.mockResolvedValue('persist:ai_custom_custom_1_a1')
    registerAccountPartition('persist:ai_custom_custom_1_a1', 'https://local.test')

    const target = await resolveAiViewTarget({ kind: 'ai-platform', modelId: 'custom_1' })

    expect(resolveActiveAccountPartition).toHaveBeenCalledWith('custom:custom_1')
    expect(target?.partition).toBe('persist:ai_custom_custom_1_a1')
  })
})
