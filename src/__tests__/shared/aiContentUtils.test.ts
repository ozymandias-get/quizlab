import type { AiContentController } from '@shared-core/types/aiContent'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
}))

const mockElectronApi = vi.hoisted(() => ({
  platform: 'linux' as string
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: mockLogger
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => mockElectronApi,
  hasElectronApi: () => true
}))

// Import after mocks
const { safeContentPaste } = await import('@shared/lib/aiContentUtils')

const asController = (value: unknown): AiContentController => value as AiContentController

describe('safeContentPaste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronApi.platform = 'linux'
  })

  it('returns false for a missing controller', async () => {
    expect(await safeContentPaste(null)).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Content controller is undefined')
    )
  })

  it('uses the managed view paste when it reports success', async () => {
    const content = { paste: vi.fn().mockResolvedValue(true) }
    expect(await safeContentPaste(asController(content))).toBe(true)
    expect(content.paste).toHaveBeenCalledTimes(1)
  })

  it('falls back to sendInputEvent when paste reports failure', async () => {
    const content = {
      paste: vi.fn().mockResolvedValue(false),
      sendInputEvent: vi.fn().mockResolvedValue(true)
    }
    expect(await safeContentPaste(asController(content))).toBe(true)
    expect(content.sendInputEvent).toHaveBeenCalledTimes(3)
  })

  it('does not retry when a native paste response is lost', async () => {
    const content = {
      paste: vi.fn().mockRejectedValue(new Error('paste failed')),
      sendInputEvent: vi.fn().mockResolvedValue(true)
    }
    expect(await safeContentPaste(asController(content))).toBeNull()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Native paste response was lost'),
      expect.any(Error)
    )
    expect(content.sendInputEvent).not.toHaveBeenCalled()
  })

  it('falls back to sendInputEvent when paste is not available', async () => {
    const content = { sendInputEvent: vi.fn().mockResolvedValue(true) }
    expect(await safeContentPaste(asController(content))).toBe(true)
    expect(content.sendInputEvent).toHaveBeenCalledTimes(3)
  })

  it('does not invoke native paste twice when the caller already tried it', async () => {
    const content = { paste: vi.fn(), sendInputEvent: vi.fn().mockResolvedValue(true) }
    expect(await safeContentPaste(asController(content), { skipNative: true })).toBe(true)
    expect(content.paste).not.toHaveBeenCalled()
  })

  it('reports failure when the managed view refuses simulated input', async () => {
    const content = { sendInputEvent: vi.fn().mockResolvedValue(false) }
    expect(await safeContentPaste(asController(content))).toBe(false)
  })

  it('reports an unknown outcome when a later simulated event is refused', async () => {
    const content = {
      sendInputEvent: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
    }
    expect(await safeContentPaste(asController(content))).toBeNull()
  })

  it('sends keyDown, char, and keyUp events', async () => {
    const content = { sendInputEvent: vi.fn().mockResolvedValue(true) }
    await safeContentPaste(asController(content))

    expect(content.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown' })
    )
    expect(content.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'char' }))
    expect(content.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'keyUp' }))
  })

  it('uses meta modifier on macOS', async () => {
    mockElectronApi.platform = 'darwin'
    const content = { sendInputEvent: vi.fn().mockResolvedValue(true) }
    await safeContentPaste(asController(content))

    expect(content.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ modifiers: ['meta'] })
    )
  })

  it('uses control modifier on non-macOS', async () => {
    mockElectronApi.platform = 'linux'
    const content = { sendInputEvent: vi.fn().mockResolvedValue(true) }
    await safeContentPaste(asController(content))

    expect(content.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ modifiers: ['control'] })
    )
  })

  it('returns false when both paste and sendInputEvent are missing', async () => {
    expect(await safeContentPaste(asController({}))).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('sendInputEvent API missing')
    )
  })

  it('returns unknown when a simulated input response is lost', async () => {
    const content = {
      sendInputEvent: vi.fn(() => {
        throw new Error('input failed')
      })
    }
    expect(await safeContentPaste(asController(content))).toBeNull()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Input simulation failed'),
      expect.any(Error)
    )
  })
})
