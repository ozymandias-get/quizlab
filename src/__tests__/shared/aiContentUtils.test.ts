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

  it('falls back to sendInputEvent when paste rejects', async () => {
    const content = {
      paste: vi.fn().mockRejectedValue(new Error('paste failed')),
      sendInputEvent: vi.fn().mockResolvedValue(true)
    }
    expect(await safeContentPaste(asController(content))).toBe(true)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Native paste failed'),
      expect.any(Error)
    )
    expect(content.sendInputEvent).toHaveBeenCalledTimes(3)
  })

  it('falls back to sendInputEvent when paste is not available', async () => {
    const content = { sendInputEvent: vi.fn().mockResolvedValue(true) }
    expect(await safeContentPaste(asController(content))).toBe(true)
    expect(content.sendInputEvent).toHaveBeenCalledTimes(3)
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

  it('returns false when sendInputEvent throws', async () => {
    const content = {
      sendInputEvent: vi.fn(() => {
        throw new Error('input failed')
      })
    }
    expect(await safeContentPaste(asController(content))).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Input simulation failed'),
      expect.any(Error)
    )
  })
})
