import { describe, expect, it, vi } from 'vitest'
import { createBrowserElectronApi } from '../../../../src/platform/electron/createBrowserElectronApi'

describe('createBrowserElectronApi', () => {
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

    const registry = await api.getAiRegistry()
    expect(
      Object.values(registry.aiRegistry).some((platform) => platform.displayName === 'My Tool')
    ).toBe(true)
  })

  it('uses clipboard writeText in browser fallback copy', async () => {
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
