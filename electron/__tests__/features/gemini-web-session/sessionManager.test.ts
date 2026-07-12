import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPath = vi.fn()
const mockGetMainWindow = vi.fn()
const mockSend = vi.fn()
const mockIsDestroyed = vi.fn()

vi.mock('electron', () => ({
  app: {
    getPath: (...args: any[]) => mockGetPath(...args)
  }
}))

vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: (...args: any[]) => mockGetMainWindow(...args)
}))

const mockOrchestratorInstance = {
  getConfig: vi.fn(),
  initialize: vi.fn(),
  getStatus: vi.fn(),
  setEnabled: vi.fn(),
  setEnabledApps: vi.fn(),
  exportSession: vi.fn(),
  importSession: vi.fn(),
  resetProfile: vi.fn(),
  ensureAuthenticated: vi.fn(),
  dispose: vi.fn()
}

vi.mock('../../../features/gemini-web-session/sessionOrchestrator.js', () => ({
  SessionOrchestrator: vi.fn(() => mockOrchestratorInstance)
}))

const mockCreateGeminiSessionPaths = vi.fn()
const mockCreateGeminiSessionConfig = vi.fn()
const mockResolvePersistentSession = vi.fn()

vi.mock('../../../features/gemini-web-session/sessionContext.js', () => ({
  createGeminiSessionPaths: (...args: any[]) => mockCreateGeminiSessionPaths(...args),
  createGeminiSessionConfig: (...args: any[]) => mockCreateGeminiSessionConfig(...args),
  resolvePersistentSession: (...args: any[]) => mockResolvePersistentSession(...args)
}))

describe('GeminiWebSessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCreateGeminiSessionPaths.mockReturnValue({
      profileDir: '/mock/profile',
      configPath: '/mock/config.json',
      lockPath: '/mock/lock',
      storageStateSnapshotPath: '/mock/snapshot.json'
    })
    mockCreateGeminiSessionConfig.mockReturnValue({
      profileDir: '/mock/profile',
      refreshIntervalMs: 60000,
      healthCheckIntervalMs: 30000
    })
    mockResolvePersistentSession.mockReturnValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('delegates getConfig to orchestrator', async () => {
    mockOrchestratorInstance.getConfig.mockReturnValue({ profileDir: '/mock' })
    const { geminiWebSessionManager } =
      await import('../../../features/gemini-web-session/sessionManager.js')
    const config = geminiWebSessionManager.getConfig()
    expect(config).toBeDefined()
  })

  it('delegates initialize to orchestrator', async () => {
    mockOrchestratorInstance.initialize.mockResolvedValue(undefined)
    const { geminiWebSessionManager } =
      await import('../../../features/gemini-web-session/sessionManager.js')
    await geminiWebSessionManager.initialize()
    expect(mockOrchestratorInstance.initialize).toHaveBeenCalled()
  })

  it('delegates getStatus to orchestrator', async () => {
    mockOrchestratorInstance.getStatus.mockResolvedValue({ state: 'healthy' })
    const { geminiWebSessionManager } =
      await import('../../../features/gemini-web-session/sessionManager.js')
    const status = await geminiWebSessionManager.getStatus()
    expect(status).toEqual({ state: 'healthy' })
  })

  it('delegates setEnabled to orchestrator', async () => {
    mockOrchestratorInstance.setEnabled.mockResolvedValue({ success: true })
    const { geminiWebSessionManager } =
      await import('../../../features/gemini-web-session/sessionManager.js')
    const result = await geminiWebSessionManager.setEnabled(true)
    expect(result).toEqual({ success: true })
  })

  it('delegates dispose to orchestrator', async () => {
    mockOrchestratorInstance.dispose.mockResolvedValue(undefined)
    const { geminiWebSessionManager } =
      await import('../../../features/gemini-web-session/sessionManager.js')
    await geminiWebSessionManager.dispose()
    expect(mockOrchestratorInstance.dispose).toHaveBeenCalled()
  })
})
