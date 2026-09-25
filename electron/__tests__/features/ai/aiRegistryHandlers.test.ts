import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => ''),
    getAppPath: vi.fn(() => ''),
    isPackaged: true,
    on: vi.fn()
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null)
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  },
  session: {
    fromPartition: vi.fn(() => ({}))
  },
  shell: {
    openExternal: vi.fn()
  }
}))

const { normalizeCustomAiUrl } = await import('../../../features/ai/aiRegistryHandlers.js')

describe('normalizeCustomAiUrl', () => {
  it('accepts an HTTPS URL without credentials', () => {
    expect(normalizeCustomAiUrl('https://example.com/chat')).toBe('https://example.com/chat')
  })

  it('rejects URLs containing credentials', () => {
    expect(normalizeCustomAiUrl('https://user:secret@example.com/chat')).toBeNull()
    expect(normalizeCustomAiUrl('https://user@example.com/chat')).toBeNull()
  })
})
