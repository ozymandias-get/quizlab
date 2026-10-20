import { vi } from 'vitest'

export interface AppToolMockState {
  showError: any

  showWarning: any

  startPicker: any

  contentController: Element | null
  autoSend: boolean

  sendTextToAI: any

  sendImageToAI: any

  sendBulkToAI: any
}

export const mockState: AppToolMockState = {
  showError: vi.fn(),
  showWarning: vi.fn(),
  startPicker: vi.fn(),
  contentController: null,
  autoSend: false,
  sendTextToAI: vi.fn(),
  sendImageToAI: vi.fn(),
  sendBulkToAI: vi.fn()
}
