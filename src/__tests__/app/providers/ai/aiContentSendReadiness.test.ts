import type { AiContentController } from '@shared-core/types/aiContent'

import {
  isContentReadyForSend,
  waitForContentReadyForSend
} from '@app/providers/ai/aiContentSendReadiness'

import { describe, expect, it, vi } from 'vitest'

function controller(overrides: Partial<AiContentController> = {}): AiContentController {
  return {
    getURL: () => 'https://chatgpt.com',
    executeJavaScript: vi.fn().mockResolvedValue('complete'),
    isDestroyed: () => false,
    ...overrides
  }
}

describe('content send readiness', () => {
  it('rejects a registered controller until its guest DOM is ready', async () => {
    const loading = controller({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    expect(await isContentReadyForSend(loading)).toBe(false)
    expect(await isContentReadyForSend(controller())).toBe(true)
  })

  it('rejects controllers without a URL or with a destroyed guest', async () => {
    expect(await isContentReadyForSend(controller({ getURL: () => undefined }))).toBe(false)
    expect(await isContentReadyForSend(controller({ isDestroyed: () => true }))).toBe(false)
  })

  it('waits through a navigation race and succeeds when the new DOM is ready', async () => {
    const loading = controller({ executeJavaScript: vi.fn().mockResolvedValue('loading') })
    const ready = controller()
    let attempts = 0

    const result = await waitForContentReadyForSend(
      () => (++attempts < 3 ? loading : ready),
      100,
      1
    )

    expect(result).toBe(true)
    expect(attempts).toBeGreaterThanOrEqual(3)
  })
})
