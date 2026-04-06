global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  unobserve() {
    return null
  }
  disconnect() {
    return null
  }
} as unknown as typeof IntersectionObserver

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn()
  }
}))

Object.defineProperty(window, 'fs', {
  value: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  },
  writable: true
})
