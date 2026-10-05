import { loadConfig, normalizeProvider } from '../../../../features/ai/apiChatHandlers/config.js'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptValue: vi.fn((value: string) => `decrypted:${value}`),
  encryptValue: vi.fn((value: string) => `encrypted:${value}`),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}))

vi.mock('../../../../core/encryption.js', () => ({
  decryptValue: mocks.decryptValue,
  encryptValue: mocks.encryptValue
}))

vi.mock('../../../../core/coreHelpers.js', () => ({
  getApiChatConfigPath: () => '/tmp/api_chat_config.json'
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: mocks.readFile,
      writeFile: mocks.writeFile,
      mkdir: mocks.mkdir,
      copyFile: vi.fn()
    }
  }
}))

const baseProvider = {
  id: 'p1',
  name: 'Ollama',
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: 'k',
  defaultModel: 'llama3',
  enabled: true,
  models: ['llama3'],
  providerType: 'openai' as const
}

describe('normalizeProvider', () => {
  it('promotes a deprecated allowLocalEndpoints alias to the canonical flag', () => {
    const result = normalizeProvider({ ...baseProvider, allowLocalEndpoints: true })
    expect(result.allowLocalNetwork).toBe(true)
    expect('allowLocalEndpoints' in result).toBe(false)
  })

  it('promotes a deprecated isCustomProvider alias to the canonical flag', () => {
    const result = normalizeProvider({ ...baseProvider, isCustomProvider: true })
    expect(result.allowLocalNetwork).toBe(true)
    expect('isCustomProvider' in result).toBe(false)
  })

  it('keeps the canonical flag and still drops both aliases', () => {
    const result = normalizeProvider({
      ...baseProvider,
      allowLocalNetwork: true,
      allowLocalEndpoints: false,
      isCustomProvider: false
    })
    expect(result.allowLocalNetwork).toBe(true)
    expect('allowLocalEndpoints' in result).toBe(false)
    expect('isCustomProvider' in result).toBe(false)
  })

  it('does not grant local access when no flag is set', () => {
    const result = normalizeProvider(baseProvider)
    expect(result.allowLocalNetwork).toBeUndefined()
    expect('allowLocalNetwork' in result).toBe(false)
  })

  it('leaves the rest of the provider untouched', () => {
    const result = normalizeProvider({ ...baseProvider, requestTimeout: 1234 })
    expect(result).toMatchObject({
      id: 'p1',
      baseUrl: 'http://127.0.0.1:11434/v1',
      providerType: 'openai',
      requestTimeout: 1234
    })
  })
})

describe('loadConfig provider migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.decryptValue.mockImplementation((value: string) => `decrypted:${value}`)
  })

  it('resolves aliases from a persisted file and returns only the canonical flag', async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({
        providers: [
          { ...baseProvider, id: 'legacy-endpoints', allowLocalEndpoints: true },
          { ...baseProvider, id: 'legacy-custom', isCustomProvider: true },
          { ...baseProvider, id: 'plain' }
        ],
        generalPrompt: 'g',
        memoryPrompt: 'm',
        characterPrompt: 'c',
        selectedProviderId: 'legacy-endpoints',
        selectedModel: 'llama3'
      })
    )

    const config = await loadConfig()

    expect(config.providers).toHaveLength(3)
    const byId = new Map(config.providers.map((p) => [p.id, p]))
    expect(byId.get('legacy-endpoints')?.allowLocalNetwork).toBe(true)
    expect(byId.get('legacy-custom')?.allowLocalNetwork).toBe(true)
    expect(byId.get('plain')?.allowLocalNetwork).toBeUndefined()
    for (const provider of config.providers) {
      expect('allowLocalEndpoints' in provider).toBe(false)
      expect('isCustomProvider' in provider).toBe(false)
      expect(provider.apiKey).toBe('decrypted:k')
    }
    expect(config.selectedProviderId).toBe('legacy-endpoints')
  })
})
