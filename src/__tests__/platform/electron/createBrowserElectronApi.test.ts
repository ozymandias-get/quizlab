import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBrowserElectronApi } from '../../../../src/platform/electron/createBrowserElectronApi'

describe('createBrowserElectronApi', () => {
  let originalClipboard: unknown

  afterEach(() => {
    // Restore navigator.clipboard to prevent state leaking across test files
    if (originalClipboard !== undefined) {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard
      })
    } else {
      delete (navigator as unknown as Record<string, unknown>).clipboard
    }
    vi.restoreAllMocks()
  })

  it('blocks unsafe external URL protocols', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const api = createBrowserElectronApi()

    expect(await api.openExternal('javascript:alert(1)')).toBe(false)
    expect(await api.openExternal('https://example.com')).toBe(true)
    expect(openSpy).toHaveBeenCalledTimes(1)
  })

  it('stores and exposes custom AI platforms in registry', async () => {
    const api = createBrowserElectronApi()
    const result = await api.addCustomAi({
      name: 'My Tool',
      url: 'https://example.com/tool',
      isSite: true
    })
    expect(result.ok).toBe(true)

    const registry = (await api.getAiRegistry())!
    expect(
      Object.values(registry.aiRegistry).some((platform) => platform.displayName === 'My Tool')
    ).toBe(true)
  })

  it('rejects custom AI entries with unsafe protocols', async () => {
    const api = createBrowserElectronApi()
    const result = await api.addCustomAi({
      name: 'Unsafe Tool',
      url: 'javascript:alert(1)',
      isSite: true
    })

    expect(result.ok).toBe(false)
  })

  it('uses clipboard writeText in browser fallback copy', async () => {
    // Save original clipboard before mocking
    originalClipboard = (navigator as unknown as Record<string, unknown>).clipboard

    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    const api = createBrowserElectronApi()
    expect(await api.copyTextToClipboard('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })
})
