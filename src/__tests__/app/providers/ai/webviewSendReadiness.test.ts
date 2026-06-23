import type { WebviewController } from '@shared-core/types/webview'

import {
  isWebviewReadyForSend,
  waitForWebviewReadyForSend
} from '@app/providers/ai/webviewSendReadiness'

import { describe, expect, it, vi } from 'vitest'

function controller(overrides: Partial<WebviewController> = {}): WebviewController {
  return {
    getURL: () => 'https://chatgpt.com',
    executeJavaScript: vi.fn().mockResolvedValue('complete'),
    isDestroyed: () => false,
    ...overrides
  }
}

describe('webview send readiness', () => {
  it('rejects a registered controller until its guest DOM is ready', async () => {
    const loading = controller({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    expect(await isWebviewReadyForSend(loading)).toBe(false)
    expect(await isWebviewReadyForSend(controller())).toBe(true)
  })

  it('rejects controllers without a URL or with a destroyed guest', async () => {
    expect(await isWebviewReadyForSend(controller({ getURL: () => undefined }))).toBe(false)
    expect(await isWebviewReadyForSend(controller({ isDestroyed: () => true }))).toBe(false)
  })

  it('waits through a navigation race and succeeds when the new DOM is ready', async () => {
    const loading = controller({ executeJavaScript: vi.fn().mockResolvedValue('loading') })
    const ready = controller()
    let attempts = 0

    const result = await waitForWebviewReadyForSend(
      () => (++attempts < 3 ? loading : ready),
      100,
      1
    )

    expect(result).toBe(true)
    expect(attempts).toBeGreaterThanOrEqual(3)
  })
})
