import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock electron app module before import
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData')
  }
}))

type CoreHelpers = typeof import('../../core/coreHelpers.js')

// Every helper resolves app.getPath('userData') plus one fixed filename. The
// filename is the part that matters: renaming it would silently orphan the
// user's saved config, and the "inside userData" and "distinct" checks follow
// from the same three assertions.
const PATHS: Array<[keyof CoreHelpers, string]> = [
  ['getCustomPlatformsPath', 'ai_custom_platforms.json'],
  ['getAiConfigPath', 'ai_custom_selectors.json'],
  ['getApiChatConfigPath', 'api_chat_config.json'],
  ['getAppSettingsPath', 'app_settings.json']
]

describe('electron/core/coreHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(PATHS)('%s resolves %s inside the userData directory', async (name, fileName) => {
    const helpers: CoreHelpers = await import('../../core/coreHelpers.js')

    const result = helpers[name]() as unknown as string

    expect(result).toBe(path.join('/mock', 'userData', fileName))
    expect(path.dirname(result)).toBe(path.join('/mock', 'userData'))
  })

  it('gives every helper a distinct destination path', async () => {
    const helpers: CoreHelpers = await import('../../core/coreHelpers.js')

    const resolved = new Set(PATHS.map(([name]) => helpers[name]() as unknown as string))

    expect(resolved.size).toBe(PATHS.length)
  })
})
