import { normalizeProvider } from '../../../../features/ai/apiChatHandlers/config.js'
import {
  getSsrOptionsForProvider,
  validateProviderUrl
} from '../../../../features/ai/apiChatHandlers/ssrf.js'

import type { ApiProviderConfig } from '../../../../../shared/types/index.js'

import { describe, expect, it } from 'vitest'

/**
 * Local-network access is an explicit, per-provider opt-in.
 *
 * It used to be granted implicitly to every `providerType === 'custom'` provider,
 * on the assumption that "custom" meant "a model server on my machine". It does
 * not: `custom` is what any provider added without a template gets, including a
 * remote endpoint such as https://my-company-api.example.com.
 */
const baseProvider: ApiProviderConfig = {
  id: 'p1',
  name: 'Provider',
  baseUrl: 'http://192.168.1.20:11434/v1',
  apiKey: '',
  defaultModel: 'llama3',
  enabled: true,
  models: ['llama3'],
  providerType: 'custom'
}

const LAN_URL = 'http://192.168.1.20:11434/v1'
const RFC1918_URL = 'http://10.0.0.5:8080/v1'
const REMOTE_URL = 'https://my-company-api.example.com/v1'

describe('local-network permission', () => {
  it('grants nothing to a custom provider that has not opted in', () => {
    expect(getSsrOptionsForProvider(baseProvider)).toBeUndefined()
    expect(baseProvider.allowLocalNetwork).toBeUndefined()
  })

  it('grants nothing to a custom provider with the flag explicitly false', () => {
    expect(getSsrOptionsForProvider({ ...baseProvider, allowLocalNetwork: false })).toBeUndefined()
  })

  it('grants local-network access to a custom provider that opted in', () => {
    const provider = { ...baseProvider, allowLocalNetwork: true }
    expect(getSsrOptionsForProvider(provider)).toEqual({ allowLocalNetwork: true })
    expect(validateProviderUrl(LAN_URL, getSsrOptionsForProvider(provider))).toBeNull()
    expect(validateProviderUrl(RFC1918_URL, getSsrOptionsForProvider(provider))).toBeNull()
  })

  it('grants local-network access for any provider type when consent is explicit', () => {
    // providerType describes the API shape, not the network location, so an
    // explicit opt-in is honoured regardless of it.
    for (const providerType of ['openai', 'anthropic', 'google', 'nvidia', 'custom'] as const) {
      const options = getSsrOptionsForProvider({
        ...baseProvider,
        providerType,
        allowLocalNetwork: true
      })
      expect(options, providerType).toEqual({ allowLocalNetwork: true })
      expect(validateProviderUrl(LAN_URL, options), providerType).toBeNull()
    }
  })

  it('blocks a LAN endpoint for a custom provider without consent', () => {
    expect(validateProviderUrl(LAN_URL, getSsrOptionsForProvider(baseProvider))).toContain(
      'Non-HTTPS'
    )
    expect(
      validateProviderUrl('https://192.168.1.20', getSsrOptionsForProvider(baseProvider))
    ).toContain('SSRF blocked')
    expect(
      validateProviderUrl('https://10.0.0.5', getSsrOptionsForProvider(baseProvider))
    ).toContain('SSRF blocked')
  })

  it('never grants special-use ranges, even with consent', () => {
    const options = getSsrOptionsForProvider({ ...baseProvider, allowLocalNetwork: true })
    expect(validateProviderUrl('https://169.254.169.254', options)).toContain('SSRF blocked')
    expect(validateProviderUrl('https://100.64.0.1', options)).toContain('SSRF blocked')
  })

  it('keeps a remote custom endpoint working, which is the point', () => {
    // A remote custom endpoint never needed local-network access, and still
    // does not get it.
    const provider = { ...baseProvider, baseUrl: REMOTE_URL }
    expect(getSsrOptionsForProvider(provider)).toBeUndefined()
    expect(validateProviderUrl(REMOTE_URL, getSsrOptionsForProvider(provider))).toBeNull()
  })

  it('leaves the local-development loopback exception alone', () => {
    // A model server on this machine needs no consent, before or after.
    const options = getSsrOptionsForProvider(baseProvider)
    expect(validateProviderUrl('http://127.0.0.1:11434/v1', options)).toBeNull()
    expect(validateProviderUrl('http://localhost:1234/v1', options)).toBeNull()
  })
})

describe('legacy config migration', () => {
  it('migrates isCustomProvider to the canonical flag at load', () => {
    const loaded = normalizeProvider({ ...baseProvider, isCustomProvider: true })
    expect(loaded.allowLocalNetwork).toBe(true)
    expect('isCustomProvider' in loaded).toBe(false)
    // ...and the migrated provider then passes the runtime check on its own.
    expect(getSsrOptionsForProvider(loaded)).toEqual({ allowLocalNetwork: true })
  })

  it('migrates allowLocalEndpoints to the canonical flag at load', () => {
    const loaded = normalizeProvider({ ...baseProvider, allowLocalEndpoints: true })
    expect(loaded.allowLocalNetwork).toBe(true)
    expect('allowLocalEndpoints' in loaded).toBe(false)
    expect(getSsrOptionsForProvider(loaded)).toEqual({ allowLocalNetwork: true })
  })

  it('does not invent consent for a migrated provider that never had any', () => {
    const loaded = normalizeProvider(baseProvider)
    expect(loaded.allowLocalNetwork).toBeUndefined()
    expect(getSsrOptionsForProvider(loaded)).toBeUndefined()
  })

  it('a brand new custom provider starts without consent', () => {
    // Mirrors what ApiSettingsTab.addProvider() creates.
    const created: ApiProviderConfig = {
      id: 'provider-1',
      name: '',
      baseUrl: '',
      apiKey: '',
      defaultModel: '',
      enabled: true,
      models: [],
      providerType: 'custom'
    }
    expect(created.allowLocalNetwork).toBeUndefined()
    expect(getSsrOptionsForProvider(created)).toBeUndefined()
  })
})
