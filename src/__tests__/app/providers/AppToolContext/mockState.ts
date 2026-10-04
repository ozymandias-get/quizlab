import { vi } from 'vitest'

export interface AppToolMockState {
  showError: any

  showWarning: any

  invalidateQueries: any

  startPicker: any

  onRefreshEvent: any

  mutateAsync: any
  contentController: Element | null
  autoSend: boolean
  geminiLoginPending: boolean

  sendTextToAI: any

  sendImageToAI: any
}

export const mockState: AppToolMockState = {
  showError: vi.fn(),
  showWarning: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  startPicker: vi.fn(),
  onRefreshEvent: vi.fn(),
  mutateAsync: vi.fn(),
  contentController: null,
  autoSend: false,
  geminiLoginPending: false,
  sendTextToAI: vi.fn(),
  sendImageToAI: vi.fn()
}
