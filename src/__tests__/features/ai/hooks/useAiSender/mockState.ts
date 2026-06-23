import { vi } from 'vitest'

export const mockState = {
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  mockUsePrompts: vi.fn((): { activePromptText: string | null } => ({ activePromptText: '' })),
  mockSafeWebviewPaste: vi.fn(() => true),
  mockUseTextInputMode: vi.fn(
    (): {
      textInputMode: 'auto' | 'paste' | 'typing'
      typingSpeed: number
      setTextInputMode: () => void
      setTypingSpeed: () => void
    } => ({
      textInputMode: 'auto',
      typingSpeed: 30,
      setTextInputMode: vi.fn(),
      setTypingSpeed: vi.fn()
    })
  )
}
