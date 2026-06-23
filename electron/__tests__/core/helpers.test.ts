import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock electron app module before import
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => `/mock/userData/${name}`)
  }
}))

describe('electron/core/helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCustomPlatformsPath returns correct path', async () => {
    const { getCustomPlatformsPath } = await import('../../core/helpers.js')
    const result = getCustomPlatformsPath()
    expect(result).toContain('ai_custom_platforms.json')
    expect(result).toContain('userData')
  })

  it('getAiConfigPath returns correct path', async () => {
    const { getAiConfigPath } = await import('../../core/helpers.js')
    const result = getAiConfigPath()
    expect(result).toContain('ai_custom_selectors.json')
    expect(result).toContain('userData')
  })

  it('getApiChatConfigPath returns correct path', async () => {
    const { getApiChatConfigPath } = await import('../../core/helpers.js')
    const result = getApiChatConfigPath()
    expect(result).toContain('api_chat_config.json')
    expect(result).toContain('userData')
  })

  it('all paths are within the userData directory', async () => {
    const helpers = await import('../../core/helpers.js')
    const { app } = await import('electron')

    const paths = [
      helpers.getCustomPlatformsPath(),
      helpers.getAiConfigPath(),
      helpers.getApiChatConfigPath()
    ]

    paths.forEach((p) => {
      expect(p).toContain(path.join('mock', 'userData'))
    })
  })

  it('paths do not overlap', async () => {
    const helpers = await import('../../core/helpers.js')
    const paths = new Set([
      helpers.getCustomPlatformsPath(),
      helpers.getAiConfigPath(),
      helpers.getApiChatConfigPath()
    ])
    expect(paths.size).toBe(3)
  })
})
