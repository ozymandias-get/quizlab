import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userDataPath: '/default-user-data',
  createPaths: vi.fn(),
  orchestratorProfiles: [] as string[]
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => state.userDataPath)
  }
}))

vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: vi.fn(() => null)
}))

vi.mock('../../../features/gemini-web-session/sessionContext.js', () => ({
  createGeminiSessionConfig: vi.fn((profileDir: string) => ({ profileDir })),
  createGeminiSessionPaths: state.createPaths,
  resolvePersistentSession: vi.fn()
}))

vi.mock('../../../features/gemini-web-session/sessionOrchestrator.js', () => ({
  SessionOrchestrator: class {
    constructor(options: { config: { profileDir: string } }) {
      state.orchestratorProfiles.push(options.config.profileDir)
    }

    getConfig() {
      return { profileDir: state.orchestratorProfiles.at(-1) }
    }
  }
}))

describe('GeminiWebSessionManager', () => {
  beforeEach(() => {
    state.userDataPath = '/default-user-data'
    state.createPaths.mockReset()
    state.orchestratorProfiles.length = 0
    state.createPaths.mockImplementation(() => ({
      profileDir: `${state.userDataPath}/gemini-web-profile`,
      configPath: `${state.userDataPath}/gemini-web-session.json`,
      lockPath: `${state.userDataPath}/gemini-web-profile/.profile.lock`,
      storageStateSnapshotPath: `${state.userDataPath}/gemini-web-profile/snapshot.json`
    }))
  })

  it('resolves userData paths lazily after profile selection', async () => {
    const module = await import('../../../features/gemini-web-session/sessionManager.js')
    expect(state.createPaths).not.toHaveBeenCalled()

    state.userDataPath = '/custom-user-data'
    module.geminiWebSessionManager.getConfig()

    expect(state.createPaths).toHaveBeenCalledTimes(1)
    expect(state.orchestratorProfiles).toEqual(['/custom-user-data/gemini-web-profile'])
  })
})
