import {
  loadConfig,
  normalizeProvider,
  saveConfig
} from '../../../../features/ai/apiChatHandlers/config.js'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptValueChecked: vi.fn((value: string) => ({ value: `decrypted:${value}`, failed: false })),
  encryptValue: vi.fn((value: string) => `encrypted:${value}`),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn()
}))

vi.mock('../../../../core/encryption.js', () => ({
  decryptValueChecked: mocks.decryptValueChecked,
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
      rename: mocks.rename,
      unlink: mocks.unlink,
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
    mocks.decryptValueChecked.mockImplementation((value: string) => ({
      value: `decrypted:${value}`,
      failed: false
    }))
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

describe('undecryptable API keys', () => {
  const storedConfig = JSON.stringify({
    providers: [{ ...baseProvider, id: 'broken-key', apiKey: 'enc:broken' }],
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: '',
    selectedProviderId: 'broken-key',
    selectedModel: 'llama3'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.rename.mockResolvedValue(undefined)
    mocks.unlink.mockResolvedValue(undefined)
    mocks.decryptValueChecked.mockImplementation((value: string) =>
      value === 'enc:broken' ? { value: '', failed: true } : { value: value, failed: false }
    )
  })

  it('keeps the encrypted key when a save follows a failed decryption', async () => {
    mocks.readFile.mockResolvedValueOnce(storedConfig)

    const config = await loadConfig()
    expect(config.providers[0].apiKey).toBe('')

    mocks.readFile.mockResolvedValueOnce(storedConfig)
    await expect(saveConfig(config)).resolves.toBe(true)

    const writeCall = mocks.writeFile.mock.calls.find(([filePath]) =>
      String(filePath).endsWith('.tmp')
    )
    expect(writeCall).toBeDefined()
    const saved = JSON.parse(String(writeCall![1])) as {
      providers: Array<{ id: string; apiKey: string }>
    }
    expect(saved.providers[0]).toMatchObject({ id: 'broken-key', apiKey: 'enc:broken' })
    expect(mocks.encryptValue).not.toHaveBeenCalled()
  })

  it('fails the save instead of overwriting the key when the file cannot be read', async () => {
    mocks.readFile.mockResolvedValueOnce(storedConfig)
    const config = await loadConfig()

    mocks.readFile.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'EACCES' })
    )

    await expect(saveConfig(config)).resolves.toBe(false)
    expect(mocks.rename).not.toHaveBeenCalled()
  })
})

describe('saveConfig atomic write', () => {
  const config = {
    providers: [baseProvider],
    generalPrompt: 'g',
    memoryPrompt: 'm',
    characterPrompt: 'c',
    selectedProviderId: 'p1',
    selectedModel: 'llama3'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.rename.mockResolvedValue(undefined)
    mocks.unlink.mockResolvedValue(undefined)
  })

  it('writes a temporary file and renames it over the config', async () => {
    await expect(saveConfig(config)).resolves.toBe(true)

    expect(mocks.writeFile).toHaveBeenCalledWith(
      '/tmp/api_chat_config.json.tmp',
      expect.any(String),
      { mode: 0o600 }
    )
    expect(mocks.rename).toHaveBeenCalledWith(
      '/tmp/api_chat_config.json.tmp',
      '/tmp/api_chat_config.json'
    )
  })

  it('does not replace the valid config when the temporary write fails', async () => {
    mocks.writeFile.mockRejectedValueOnce(new Error('disk full'))

    await expect(saveConfig(config)).resolves.toBe(false)

    expect(mocks.rename).not.toHaveBeenCalled()
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/api_chat_config.json.tmp')
  })

  it('serialises two overlapping saves so the temporary file stays whole', async () => {
    let releaseFirst!: () => void
    mocks.writeFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
    )

    const first = saveConfig(config)
    await Promise.resolve()
    const second = saveConfig({ ...config, generalPrompt: 'second' })
    await Promise.resolve()

    expect(mocks.writeFile).toHaveBeenCalledTimes(1)

    releaseFirst()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(mocks.rename).toHaveBeenCalledTimes(2)
  })
})
