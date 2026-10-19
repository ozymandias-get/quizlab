import { describe, expect, it, vi } from 'vitest'

import {
  buildBuiltinSiteSessionTargets,
  buildSiteSessionTargets,
  toSiteSessionView
} from '../../../features/web-session/siteSessionTargets.js'

/**
 * The custom platform store lives in the user data directory, so it is stubbed
 * here: the target derivation is a pure function of the registry plus the
 * user-added sites, and the store itself is covered by its own tests.
 */
const { customPlatforms } = vi.hoisted(() => ({
  customPlatforms: {
    custom_site: {
      id: 'custom_site',
      name: 'Wiki',
      url: 'https://wiki.example.com/docs',
      isSite: true,
      partition: 'persist:ai_custom_custom_site'
    },
    custom_model: {
      id: 'custom_model',
      name: 'Model',
      url: 'https://api.example.com',
      isSite: false,
      partition: 'persist:ai_custom_custom_model'
    }
  }
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: vi.fn(async () => customPlatforms)
}))

describe('built-in site session targets', () => {
  const targets = buildBuiltinSiteSessionTargets()

  it('groups every Google app into a single target', () => {
    const google = targets.filter((target) => target.kind === 'google')
    expect(google).toHaveLength(1)
    expect(google[0].siteId).toBe('google')
    expect(google[0].memberAppIds).toEqual(['gemini', 'aistudio', 'youtube', 'gdrive'])
    expect(google[0].partition).toBe('persist:gemini_web_profile')
  })

  it('gives every other site its own partition', () => {
    const chatgpt = targets.find((target) => target.siteId === 'chatgpt')
    expect(chatgpt?.partition).toBe('persist:ai_chatgpt')
    const claude = targets.find((target) => target.siteId === 'claude')
    expect(claude?.partition).toBe('persist:ai_claude')
  })

  it('never emits two targets with the same siteId', () => {
    const ids = targets.map((target) => target.siteId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers the built-in AI platforms that ship enabled', () => {
    const ids = targets.map((target) => target.siteId)
    for (const siteId of ['chatgpt', 'claude', 'deepseek', 'qwen', 'kimi', 'm365']) {
      expect(ids).toContain(siteId)
    }
  })
})

describe('custom site session targets', () => {
  it('adds one target per user-added site', async () => {
    const targets = await buildSiteSessionTargets()
    const custom = targets.find((target) => target.siteId === 'custom:custom_site')
    expect(custom?.kind).toBe('custom')
    expect(custom?.hostname).toBe('wiki.example.com')
    expect(custom?.partition).toBe('persist:ai_custom_custom_site')
    expect(custom?.cookieDomains).toEqual(['.wiki.example.com'])
    expect(custom?.labelKey).toBe('ws_target_custom')
    expect(custom?.memberAppIds).toEqual(['custom_site'])
  })

  it('skips custom platforms that are not sites', async () => {
    const targets = await buildSiteSessionTargets()
    expect(targets.map((target) => target.siteId)).not.toContain('custom:custom_model')
  })
})

describe('site session view', () => {
  // The Google group is the first row of the target list.
  const [googleTarget] = buildBuiltinSiteSessionTargets()

  it('maps a target onto the renderer view without the partition', () => {
    expect(
      toSiteSessionView(googleTarget, true, 'imported', '2026-10-19T10:00:00.000Z', null)
    ).toEqual({
      siteId: 'google',
      labelKey: 'ws_target_google',
      hostname: 'accounts.google.com',
      kind: 'google',
      memberAppIds: ['gemini', 'aistudio', 'youtube', 'gdrive'],
      enabled: true,
      status: 'imported',
      importedAt: '2026-10-19T10:00:00.000Z',
      lastError: null
    })
  })

  it('copies the member app ids instead of sharing the array', () => {
    const view = toSiteSessionView(googleTarget, false, 'manual_session', null, 'boom')
    expect(view.memberAppIds).not.toBe(googleTarget.memberAppIds)
    expect(view.memberAppIds).toEqual(googleTarget.memberAppIds)
  })
})
