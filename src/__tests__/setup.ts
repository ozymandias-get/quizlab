import '@testing-library/jest-dom'
import { vi } from 'vitest'

const originalConsoleError = console.error
const ALLOWPOPUPS_WARNING_FRAGMENT = 'non-boolean attribute `allowpopups`'
const REACT_NON_BOOLEAN_ATTR_FORMAT = 'non-boolean attribute `%s`'

function applyConsoleErrorFilter() {
  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : ''
    const hasDirectAllowPopupsWarning = firstArg.includes(ALLOWPOPUPS_WARNING_FRAGMENT)
    const hasFormattedAllowPopupsWarning =
      firstArg.includes(REACT_NON_BOOLEAN_ATTR_FORMAT) && args.some((arg) => arg === 'allowpopups')
    const joinedArgs = args.map((arg) => String(arg)).join(' ')
    const hasAnyAllowPopupsNonBooleanWarning =
      joinedArgs.includes('allowpopups') && joinedArgs.includes('non-boolean attribute')

    if (
      hasDirectAllowPopupsWarning ||
      hasFormattedAllowPopupsWarning ||
      hasAnyAllowPopupsNonBooleanWarning
    ) {
      return
    }
    originalConsoleError(...args)
  }
}

applyConsoleErrorFilter()

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

if (typeof window !== 'undefined') {
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
}

vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn()
  }
}))

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'fs', {
    value: {
      readFile: vi.fn(),
      writeFile: vi.fn()
    },
    writable: true
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  applyConsoleErrorFilter()
})
