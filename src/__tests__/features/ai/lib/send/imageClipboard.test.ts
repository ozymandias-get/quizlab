/**
 * Unit coverage for the two side-effect units the image send pipeline delegates
 * to: the clipboard round-trip and the paste-never-landed predicate.
 *
 * Both used to live inline in a 330-line orchestration function, where the
 * restore's "exactly once, even from a `finally`" contract and the retry count
 * could not be asserted without driving the whole pipeline.
 */
import {
  copyImageToClipboardWithRetry,
  createClipboardRestore
} from '@features/ai/lib/send/imageClipboard'
import { isPasteIgnoredByPage } from '@features/ai/lib/send/imageSendSubmitDiagnosis'
import type { AiSendDiagnostics } from '@features/ai/model/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const restoreClipboard = vi.fn()

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn()
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  reportSuppressedError: vi.fn()
}))

function makeDiagnostics(): AiSendDiagnostics {
  return {
    pipeline: 'image',
    currentAI: 'chatgpt',
    autoSend: true,
    timings: { queueWaitMs: 0, configResolveMs: 0, totalMs: 0 }
  } as unknown as AiSendDiagnostics
}

describe('copyImageToClipboardWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stops at the first success', async () => {
    const copy = vi.fn().mockResolvedValue(true)

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        diagnostics: makeDiagnostics()
      })
    ).resolves.toBe(true)

    expect(copy).toHaveBeenCalledTimes(1)
  })

  it('gives up after three refusals and still records the elapsed time', async () => {
    const copy = vi.fn().mockResolvedValue(false)
    const diagnostics = makeDiagnostics()

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        diagnostics
      })
    ).resolves.toBe(false)

    expect(copy).toHaveBeenCalledTimes(3)
    expect(typeof diagnostics.timings.clipboardMs).toBe('number')
  })

  it('treats a thrown write as a refusal instead of aborting the send', async () => {
    const copy = vi
      .fn()
      .mockRejectedValueOnce(new Error('clipboard busy'))
      .mockResolvedValueOnce(true)

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        diagnostics: makeDiagnostics()
      })
    ).resolves.toBe(true)

    expect(copy).toHaveBeenCalledTimes(2)
  })
})

describe('createClipboardRestore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getElectronApi).mockReturnValue({
      restoreClipboard
    } as unknown as ReturnType<typeof getElectronApi>)
  })

  it('restores once and stays a no-op afterwards', async () => {
    const clipboard = createClipboardRestore()

    expect(clipboard.pending).toBe(true)
    await clipboard.restore()
    await clipboard.restore()

    expect(restoreClipboard).toHaveBeenCalledTimes(1)
    expect(clipboard.pending).toBe(false)
  })

  it('reports a swallowed restore failure without throwing', async () => {
    restoreClipboard.mockRejectedValueOnce(new Error('gone'))
    const clipboard = createClipboardRestore()

    await expect(clipboard.restore()).resolves.toBeUndefined()
    // The attempt still counts as done, so a later `finally` does not retry it.
    expect(clipboard.pending).toBe(false)
  })

  it('survives a missing bridge', async () => {
    vi.mocked(getElectronApi).mockReturnValue(null)
    const clipboard = createClipboardRestore()

    await expect(clipboard.restore()).resolves.toBeUndefined()
    expect(clipboard.pending).toBe(false)
  })
})

describe('isPasteIgnoredByPage', () => {
  it('is true only when the target never became interactive and nothing mutated', () => {
    expect(isPasteIgnoredByPage({ everReady: false, mutationCount: 0 } as never)).toBe(true)
    expect(isPasteIgnoredByPage({ everReady: false, mutationCount: 3 } as never)).toBe(false)
    expect(isPasteIgnoredByPage({ everReady: true, mutationCount: 0 } as never)).toBe(false)
  })

  it('is false when the runtime reported nothing', () => {
    expect(isPasteIgnoredByPage(null)).toBe(false)
    expect(isPasteIgnoredByPage(undefined)).toBe(false)
    expect(isPasteIgnoredByPage({} as never)).toBe(false)
  })
})
